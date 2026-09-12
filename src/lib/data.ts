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

export type PortfolioData = {
  portfolio: PersistedPortfolio;
  portfolios: PersistedPortfolio[];
  rules: PersistedRule[];
  activities: PersistedActivity[];
  trades: PersistedTrade[];
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
function apiUrl(path: string): string { return `${API_BASE}${path}`; }

async function request<T>(init: RequestInit & { query?: string } = {}): Promise<T> {
  const response = await fetch(apiUrl(`/api/data${init.query ?? ''}`), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
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
  return { ...data, rules: data.rules.map(normalizeRule) };
}

export async function savePortfolio(wallet: string, input: { id?: string; name: string; description?: string }): Promise<PersistedPortfolio> {
  const data = await request<{ portfolio: PersistedPortfolio }>({ method: 'POST', body: JSON.stringify({ action: 'savePortfolio', wallet, ...input }) });
  return data.portfolio;
}

export async function saveRule(wallet: string, input: { id?: string; portfolioId: string; ruleType: string; enabled: boolean; parameters: Record<string, unknown> }): Promise<PersistedRule> {
  const wireRuleType = input.ruleType === 'target_allocations' ? 'target_allocation' : input.ruleType;
  const data = await request<{ rule: PersistedRule }>({ method: 'POST', body: JSON.stringify({ action: 'saveRule', wallet, ...input, ruleType: wireRuleType }) });
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
