import { getConnectedWalletSigner } from './wallet';
import { apiUrl, readJson } from './api';

export type PersistedRule = {
  id: string;
  portfolio_id: string;
  rule_type: string;
  enabled: boolean;
  parameters: Record<string, unknown>;
};

export type PersistedPortfolio = {
  id: string;
  name: string;
  description: string | null;
  network: string;
  wallet_address: string;
};

export type PersistedActivity = {
  id: string;
  event_type: string;
  network: string;
  signature: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type PersistedTrade = {
  id: string;
  quote_id: string;
  asset_id: string;
  side: 'buy' | 'sell';
  asset_amount_units: string;
  cash_amount_units: string;
  status: string;
  payment_signature: string | null;
  settlement_signature: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type PersistedProposalPayload = Record<string, unknown> & {
  fingerprint?: string;
  kind?: string;
  symbol?: string;
  executionSignature?: string;
  paymentSignature?: string;
  executedAt?: string;
};

export type PersistedProposal = {
  id: string;
  portfolio_id: string;
  wallet_address: string;
  chain_snapshot: Record<string, unknown>;
  proposal: PersistedProposalPayload;
  status: string;
  created_at: string;
  expires_at: string | null;
};

export type PortfolioData = {
  portfolio: PersistedPortfolio;
  portfolios: PersistedPortfolio[];
  rules: PersistedRule[];
  proposals: PersistedProposal[];
  activities: PersistedActivity[];
  trades: PersistedTrade[];
};

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function signedMutationHeaders(body: string, wallet: string): Promise<Record<string, string>> {
  const parsed = JSON.parse(body) as { action?: string };
  const protectedActions = new Set(['savePortfolio', 'saveRule', 'recordRuleProposal', 'updateRuleProposal']);
  if (!parsed.action || !protectedActions.has(parsed.action)) return {};
  const signer = getConnectedWalletSigner();
  if (signer.publicKey.toBase58() !== wallet) throw new Error('The connected signing wallet does not match this portfolio wallet.');
  const timestamp = String(Date.now());
  const message = `StockPassport authorization\n${wallet}\n${timestamp}\nPOST\n/api/data\n${body}`;
  const result = await signer.signMessage(new TextEncoder().encode(message));
  const signature = result instanceof Uint8Array ? result : result.signature;
  return {
    'X-SP-Auth-Timestamp': timestamp,
    'X-SP-Auth-Message': message,
    'X-SP-Auth-Signature': toBase64(signature),
  };
}

async function request<T>(init: RequestInit & { query?: string; wallet?: string } = {}): Promise<T> {
  const body = typeof init.body === 'string' ? init.body : undefined;
  const authHeaders = body && init.wallet ? await signedMutationHeaders(body, init.wallet) : {};
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
    ...authHeaders,
  };
  const response = await fetch(apiUrl(`/api/data${init.query ?? ''}`), {
    ...init,
    headers,
    cache: 'no-store',
  });
  return readJson<T>(response);
}

function normalizeRule(rule: PersistedRule): PersistedRule {
  return rule;
}

export async function loadPortfolioData(wallet: string): Promise<PortfolioData> {
  const data = await request<PortfolioData>({ query: `?wallet=${encodeURIComponent(wallet)}` });
  return {
    ...data,
    rules: data.rules.map(normalizeRule),
    proposals: data.proposals ?? [],
    activities: data.activities ?? [],
    trades: data.trades ?? [],
  };
}

export async function savePortfolio(wallet: string, input: { id?: string; name: string; description?: string }): Promise<PersistedPortfolio> {
  const body = JSON.stringify({ action: 'savePortfolio', wallet, ...input });
  const data = await request<{ portfolio: PersistedPortfolio }>({ method: 'POST', body, wallet });
  return data.portfolio;
}

export async function saveRule(wallet: string, input: { id?: string; portfolioId: string; ruleType: string; enabled: boolean; parameters: Record<string, unknown> }): Promise<PersistedRule> {
  const wireRuleType = input.ruleType === 'target_allocations' ? 'target_allocation' : input.ruleType;
  const body = JSON.stringify({ action: 'saveRule', wallet, ...input, ruleType: wireRuleType });
  const data = await request<{ rule: PersistedRule }>({ method: 'POST', body, wallet });
  return normalizeRule(data.rule);
}

export async function recordRuleProposal(wallet: string, input: { portfolioId: string; proposal: Record<string, unknown>; chainSnapshot?: Record<string, unknown>; status?: string; expiresAt?: string }): Promise<PersistedProposal> {
  const body = JSON.stringify({ action: 'recordRuleProposal', wallet, ...input });
  const data = await request<{ proposal: PersistedProposal }>({ method: 'POST', body, wallet });
  return data.proposal;
}

export async function updateRuleProposal(wallet: string, id: string, input: { status: string; proposal?: Record<string, unknown>; chainSnapshot?: Record<string, unknown> }): Promise<PersistedProposal> {
  const body = JSON.stringify({ action: 'updateRuleProposal', wallet, id, ...input });
  const data = await request<{ proposal: PersistedProposal }>({ method: 'POST', body, wallet });
  return data.proposal;
}

export async function recordActivity(wallet: string, input: { eventType: string; signature?: string; payload?: Record<string, unknown> }): Promise<PersistedActivity> {
  const data = await request<{ activity: PersistedActivity }>({
    method: 'POST',
    body: JSON.stringify({ action: 'recordActivity', wallet, ...input }),
  });
  return data.activity;
}

export async function recordTradeIntent(wallet: string, input: { quoteId: string; assetId: string; side: 'buy' | 'sell'; assetAmountUnits: string; cashAmountUnits: string; status: string; paymentSignature?: string; settlementSignature?: string; errorMessage?: string }): Promise<PersistedTrade> {
  const data = await request<{ trade: PersistedTrade }>({
    method: 'POST',
    body: JSON.stringify({ action: 'recordTradeIntent', wallet, ...input }),
  });
  return data.trade;
}
