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

export type PersistedProposal = {
  id: string;
  portfolio_id: string;
  wallet_address: string;
  chain_snapshot: Record<string, unknown>;
  proposal: Record<string, unknown>;
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

type BrowserWallet = {
  signMessage?: (message: Uint8Array) => Promise<Uint8Array | { signature: Uint8Array }>;
};

type WindowWithWallet = Window & { solana?: BrowserWallet };

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
function apiUrl(path: string): string { return `${API_BASE}${path}`; }

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function signedMutationHeaders(body: string, wallet: string): Promise<Record<string, string>> {
  const parsed = JSON.parse(body) as { action?: string };
  if (parsed.action !== 'savePortfolio' && parsed.action !== 'saveRule') return {};
  const signer = (window as WindowWithWallet).solana;
  if (!signer?.signMessage) throw new Error('Wallet message signing is required to save portfolio settings or rules.');
  const timestamp = String(Date.now());
  const message = `StockPassport authorization\n${wallet}\n${timestamp}\nPOST\n/api/data\n${body}`;
  const result = await signer.signMessage(new TextEncoder().encode(message));
  const signature = result instanceof Uint8Array ? result : result.signature;
  return { 'X-SP-Auth-Timestamp': timestamp, 'X-SP-Auth-Message': message, 'X-SP-Auth-Signature': toBase64(signature) };
}

async function request<T>(init: RequestInit & { query?: string; wallet?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) };
  if (init.method === 'POST' && typeof init.body === 'string' && init.wallet) Object.assign(headers, await signedMutationHeaders(init.body, init.wallet));
  const response = await fetch(apiUrl(`/api/data${init.query ?? ''}`), {
    ...init,
    headers,
    cache: 'no-store',
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Unable to persist StockPassport state');
  return data;
}

function normalizeRule(rule: PersistedRule): PersistedRule {
  return rule;
}

export async function loadPortfolioData(wallet: string): Promise<PortfolioData> {
  const data = await request<PortfolioData>({ query: `?wallet=${encodeURIComponent(wallet)}` });
  return { ...data, rules: data.rules.map(normalizeRule), proposals: data.proposals ?? [] };
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

export async function recordActivity(wallet: string, input: { eventType: string; signature?: string; payload?: Record<string, unknown> }): Promise<PersistedActivity> {
  const data = await request<{ activity: PersistedActivity }>({ method: 'POST', body: JSON.stringify({ action: 'recordActivity', wallet, ...input }) });
  return data.activity;
}

export async function recordTradeIntent(wallet: string, input: { quoteId: string; assetId: string; side: 'buy' | 'sell'; assetAmountUnits: string; cashAmountUnits: string; status: string; paymentSignature?: string; settlementSignature?: string; errorMessage?: string }): Promise<PersistedTrade> {
  const data = await request<{ trade: PersistedTrade }>({ method: 'POST', body: JSON.stringify({ action: 'recordTradeIntent', wallet, ...input }) });
  return data.trade;
}
