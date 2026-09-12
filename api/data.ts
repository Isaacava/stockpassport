import { createClient } from '@supabase/supabase-js';
import { PublicKey } from '@solana/web3.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function requireWallet(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('wallet is required');
  const wallet = value.trim();
  new PublicKey(wallet);
  return wallet;
}

function getDb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase server configuration is missing');
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const db = getDb();

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const wallet = requireWallet(url.searchParams.get('wallet'));
      const [portfolioResult, activityResult, tradesResult] = await Promise.all([
        db.from('portfolios').select('id,name,description,network,wallet_address,created_at,updated_at').eq('wallet_address', wallet).order('created_at', { ascending: true }),
        db.from('activity_events').select('id,event_type,network,signature,payload,created_at').eq('wallet_address', wallet).order('created_at', { ascending: false }).limit(100),
        db.from('trade_intents').select('id,quote_id,asset_id,side,asset_amount_units,cash_amount_units,status,payment_signature,settlement_signature,error_message,created_at,updated_at').eq('wallet_address', wallet).order('created_at', { ascending: false }).limit(100),
      ]);
      if (portfolioResult.error) throw portfolioResult.error;
      if (activityResult.error) throw activityResult.error;
      if (tradesResult.error) throw tradesResult.error;

      const portfolios = portfolioResult.data ?? [];
      let portfolio = portfolios[0] ?? null;
      if (!portfolio) {
        const created = await db.from('portfolios').insert({ wallet_address: wallet, user_id: null, name: 'My Portfolio', description: 'Default StockPassport portfolio', network: 'devnet' }).select('id,name,description,network,wallet_address,created_at,updated_at').single();
        if (created.error) throw created.error;
        portfolio = created.data;
      }

      const rules = await db.from('portfolio_rules').select('id,portfolio_id,rule_type,enabled,parameters,created_at,updated_at').eq('portfolio_id', portfolio.id).order('created_at', { ascending: true });
      if (rules.error) throw rules.error;

      return json({ portfolio, portfolios, rules: rules.data ?? [], activities: activityResult.data ?? [], trades: tradesResult.data ?? [] });
    }

    const body = await req.json() as { action?: string; wallet?: string; [key: string]: unknown };
    const wallet = requireWallet(body.wallet);

    if (body.action === 'savePortfolio') {
      const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'My Portfolio';
      const description = typeof body.description === 'string' ? body.description.trim() : null;
      const id = typeof body.id === 'string' && body.id ? body.id : undefined;
      const result = id
        ? await db.from('portfolios').update({ name, description, wallet_address: wallet }).eq('id', id).eq('wallet_address', wallet).select('id,name,description,network,wallet_address,created_at,updated_at').single()
        : await db.from('portfolios').insert({ wallet_address: wallet, user_id: null, name, description, network: 'devnet' }).select('id,name,description,network,wallet_address,created_at,updated_at').single();
      if (result.error) throw result.error;
      return json({ portfolio: result.data });
    }

    if (body.action === 'saveRule') {
      if (typeof body.portfolioId !== 'string' || typeof body.ruleType !== 'string') throw new Error('portfolioId and ruleType are required');
      const portfolio = await db.from('portfolios').select('id').eq('id', body.portfolioId).eq('wallet_address', wallet).single();
      if (portfolio.error) throw portfolio.error;
      const parameters = body.parameters && typeof body.parameters === 'object' ? body.parameters : {};
      const result = await db.from('portfolio_rules').upsert({ id: typeof body.id === 'string' ? body.id : undefined, portfolio_id: body.portfolioId, rule_type: body.ruleType, enabled: body.enabled !== false, parameters }, { onConflict: 'id' }).select('id,portfolio_id,rule_type,enabled,parameters,created_at,updated_at').single();
      if (result.error) throw result.error;
      return json({ rule: result.data });
    }

    if (body.action === 'recordActivity') {
      const result = await db.from('activity_events').insert({ wallet_address: wallet, user_id: null, event_type: typeof body.eventType === 'string' ? body.eventType : 'activity', network: 'devnet', signature: typeof body.signature === 'string' ? body.signature : null, payload: body.payload && typeof body.payload === 'object' ? body.payload : {} }).select('id,event_type,network,signature,payload,created_at').single();
      if (result.error) throw result.error;
      return json({ activity: result.data });
    }

    if (body.action === 'recordTradeIntent') {
      const required = ['quoteId', 'assetId', 'side', 'assetAmountUnits', 'cashAmountUnits'];
      for (const key of required) if (typeof body[key] !== 'string') throw new Error(`${key} is required`);
      const result = await db.from('trade_intents').upsert({ wallet_address: wallet, user_id: null, quote_id: body.quoteId, asset_id: body.assetId, side: body.side, asset_amount_units: body.assetAmountUnits, cash_amount_units: body.cashAmountUnits, status: typeof body.status === 'string' ? body.status : 'created', payment_signature: typeof body.paymentSignature === 'string' ? body.paymentSignature : null, settlement_signature: typeof body.settlementSignature === 'string' ? body.settlementSignature : null, error_message: typeof body.errorMessage === 'string' ? body.errorMessage : null }, { onConflict: 'quote_id,wallet_address' }).select('id,quote_id,asset_id,side,asset_amount_units,cash_amount_units,status,payment_signature,settlement_signature,error_message,created_at,updated_at').single();
      if (result.error) throw result.error;
      return json({ trade: result.data });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : 'Database request failed' }, 400);
  }
}
