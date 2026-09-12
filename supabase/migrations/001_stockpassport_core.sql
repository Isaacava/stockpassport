-- StockPassport application persistence layer.
-- Solana remains the source of truth for token ownership and confirmed transactions.
-- These tables store application metadata, rules, proposals and an auditable index.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  wallet_address text unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  network text not null default 'devnet' check (network in ('devnet', 'mainnet-beta')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_rules (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  rule_type text not null check (rule_type in (
    'max_allocation',
    'min_cash_reserve',
    'rebalance_threshold',
    'recurring_contribution'
  )),
  enabled boolean not null default true,
  parameters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rule_proposals (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  wallet_address text not null,
  chain_snapshot jsonb not null default '{}'::jsonb,
  proposal jsonb not null default '{}'::jsonb,
  status text not null default 'proposed' check (status in ('proposed', 'authorized', 'executed', 'expired', 'rejected')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.trade_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  wallet_address text not null,
  quote_id text not null,
  asset_id text not null,
  side text not null check (side in ('buy', 'sell')),
  asset_amount_units numeric(78,0) not null,
  cash_amount_units numeric(78,0) not null,
  status text not null default 'created' check (status in (
    'created', 'payment_pending', 'payment_confirmed', 'settlement_pending',
    'settled', 'failed', 'expired'
  )),
  payment_signature text,
  settlement_signature text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_id, wallet_address)
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  wallet_address text not null,
  event_type text not null,
  network text not null default 'devnet',
  signature text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists portfolios_user_id_idx on public.portfolios(user_id);
create index if not exists rules_portfolio_id_idx on public.portfolio_rules(portfolio_id);
create index if not exists proposals_portfolio_id_idx on public.rule_proposals(portfolio_id);
create index if not exists trade_intents_wallet_idx on public.trade_intents(wallet_address);
create index if not exists activity_events_wallet_idx on public.activity_events(wallet_address);
create index if not exists activity_events_signature_idx on public.activity_events(signature);

alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.portfolio_rules enable row level security;
alter table public.rule_proposals enable row level security;
alter table public.trade_intents enable row level security;
alter table public.activity_events enable row level security;

create policy "profiles owner read" on public.profiles for select using (auth.uid() = id);
create policy "profiles owner insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles owner update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "portfolios owner read" on public.portfolios for select using (auth.uid() = user_id);
create policy "portfolios owner insert" on public.portfolios for insert with check (auth.uid() = user_id);
create policy "portfolios owner update" on public.portfolios for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "portfolios owner delete" on public.portfolios for delete using (auth.uid() = user_id);

create policy "rules owner read" on public.portfolio_rules for select using (
  exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid())
);
create policy "rules owner insert" on public.portfolio_rules for insert with check (
  exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid())
);
create policy "rules owner update" on public.portfolio_rules for update using (
  exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid())
) with check (
  exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid())
);
create policy "rules owner delete" on public.portfolio_rules for delete using (
  exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid())
);

create policy "proposals owner read" on public.rule_proposals for select using (
  exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid())
);

create policy "trade intents owner read" on public.trade_intents for select using (
  auth.uid() = user_id
);

create policy "activity owner read" on public.activity_events for select using (
  auth.uid() = user_id
);
