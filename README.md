# StockPassport

StockPassport is a Solana-native programmable portfolio for tokenized-stock assets.

## Hackathon wedge

StockPassport focuses on **programmable investing**: users define how a portfolio should behave, review deterministic proposals generated from real on-chain holdings, and explicitly authorize real transactions.

## Current Devnet demo

The Devnet build uses real Solana transactions with synthetic demo assets:

- `NVDAx-DEMO`
- `AAPLx-DEMO`
- `MSFTx-DEMO`
- `GOOGx-DEMO`
- `DEMO-USDC`

These are test securities only. They are not claims on real-world equity ownership.

The working flow is:

```text
Connect wallet
  ↓
Read confirmed Solana balances
  ↓
Discover synthetic assets
  ↓
Request short-lived quote
  ↓
User signs payment transaction
  ↓
Server verifies exact on-chain payment
  ↓
Market authority settles opposing leg
  ↓
Fresh on-chain balance read
  ↓
Supabase trade/audit record
```

## Product pages

- **Overview** — live Devnet state, portfolio value, cash, SOL, rules and health.
- **Discover** — synthetic asset discovery, quotes, buys and sells.
- **Portfolio** — persistent portfolio configuration and confirmed positions.
- **Rules** — max allocation, reserve, rebalance threshold and recurring contribution controls.
- **Activity** — persistent trade lifecycle and audit signatures.
- **Passport** — wallet/network/portfolio identity and verification links.

## Architecture

```text
                    ┌──────────────────────┐
                    │       Vercel         │
                    │ StockPassport frontend│
                    └──────────┬───────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
          ┌──────▼──────┐            ┌──────▼─────────┐
          │  Supabase   │            │ Render Free    │
          │ PostgreSQL  │            │ market service │
          └──────┬──────┘            └──────┬─────────┘
                 │                          │
                 │                          ▼
                 │                    Solana Devnet
                 │                          │
                 └──────────────┬───────────┘
                                ▼
                       Application state
```

Solana is authoritative for token ownership and confirmed transactions. Supabase stores application metadata, rules, proposals, trade lifecycle and audit information. The browser never receives the market wallet secret or Supabase service-role key.

## Services

### Vercel

Deploy the `main` branch as a separate Vercel project. Browser variables:

```text
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_NETWORK=devnet
VITE_DEVNET_CASH_MINT=<demo cash mint>
VITE_DEVNET_NVDA_MINT=<nvda demo mint>
VITE_DEVNET_AAPL_MINT=<aapl demo mint>
VITE_DEVNET_MSFT_MINT=<msft demo mint>
VITE_DEVNET_GOOG_MINT=<goog demo mint>
```

### Render

StockPassport has a separate Render service named `stockpassport-market`.

Server variables:

```text
DEVNET_RPC_URL=https://api.devnet.solana.com
DEVNET_MARKET_KEYPAIR_JSON=<dedicated devnet market secret>
DEVNET_MARKET_WALLET=<market public key>
DEVNET_CASH_MINT=<demo cash mint>
DEVNET_NVDA_MINT=<nvda demo mint>
DEVNET_AAPL_MINT=<aapl demo mint>
DEVNET_MSFT_MINT=<msft demo mint>
DEVNET_GOOG_MINT=<goog demo mint>
SUPABASE_URL=https://pwcsnthuvebzfpqprslw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
```

Never put the market secret or service-role key in `VITE_*` variables or source control.

### Supabase

The dedicated StockPassport project stores:

- portfolios
- portfolio rules
- rule proposals
- trade intents
- activity events
- profile metadata

RLS is enabled. Server-side service-role access is used only by protected API handlers.

## Devnet asset bootstrap

The repository includes:

```bash
npm install
npm run devnet:assets
```

The script requires a funded Devnet payer keypair through `SOLANA_KEYPAIR`. It creates the synthetic Demo-USDC and stock mints and seeds the market/payer wallet's inventory.

Do not commit the payer keypair, generated `.env.devnet`, or any server secrets.

## Security / truth model

- no fake portfolio balances
- no client-side private keys
- integer/base-unit settlement arithmetic
- quote expiry enforced
- exact transaction-delta verification
- confirmed chain state re-read after execution
- retry-safe trade lifecycle using quote IDs
- Demo faucet is rate-limited per wallet on the server
- legacy SPL and Token-2022 token accounts are both discoverable
- Mainnet execution is an explicit adapter boundary and is not simulated

## Mainnet direction

Production mode is designed to use established Solana tokenized-stock infrastructure such as xStocks/Jupiter or another compatible execution adapter. StockPassport does not claim that Mainnet trading is enabled merely because the Devnet UI exists.

## Development continuation

`build.md` is the canonical engineering handoff. It records the current architecture, verified milestones, blockers, deployment status and next highest-priority task.
