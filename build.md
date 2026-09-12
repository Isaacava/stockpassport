# StockPassport Build Log

## Project
- Repo: `Isaacava/stockpassport`
- Product: StockPassport — Solana-native programmable portfolio for synthetic tokenized-stock demo assets on Devnet, with a Mainnet reference-price layer and a Mainnet execution adapter target.
- Current network: Solana Devnet for all demo execution.
- Hackathon window: 6 days remaining from 2026-09-12.

## Architecture
- Vercel: frontend.
- Render Free: separate `stockpassport-market` service for protected/server API handlers.
- Supabase Free: dedicated `StockPassport` project for application persistence.
- Solana Devnet: authoritative source of synthetic token ownership and confirmed demo transactions.
- Solana Mainnet via Jupiter Price API V3: reference source for supported xStock market prices.
- Existing AgentMarket Vercel/Render projects remain untouched.

## Supabase
- Project: `StockPassport`
- Project ref: `pwcsnthuvebzfpqprslw`
- Region: `eu-west-1`
- Status verified: `ACTIVE_HEALTHY`
- URL: `https://pwcsnthuvebzfpqprslw.supabase.co`
- Core tables live: profiles, portfolios, portfolio_rules, rule_proposals, trade_intents, activity_events.
- Portfolio records have wallet-native ownership metadata.
- `set_updated_at` trigger function has fixed `search_path`.
- Foreign-key indexes were added for activity/trade user IDs.
- Security advisor currently reports no security lints.
- Known remaining API hardening: `/api/data` validates wallet syntax but does not yet cryptographically authenticate wallet ownership with a signed challenge.

## Completed product foundation
### Wallet/on-chain
- React + TypeScript + Vite scaffold.
- Devnet RPC connection and confirmed SOL reads.
- Wallet connect/disconnect using `window.solana` signing provider.
- Confirmed token-account discovery.
- Explorer address/transaction links.
- Synthetic assets are always labelled as demo securities.

### Devnet assets
- Demo-USDC plus NVDAx-DEMO, AAPLx-DEMO, MSFTx-DEMO and GOOGx-DEMO.
- Bootstrap script creates deterministic synthetic assets and writes mint configuration.
- Current demo mints use legacy SPL Token.
- Demo tokens never represent real-world equity ownership.

### Mainnet reference-price layer
- Added `api/mainnet/prices.ts` backed by Jupiter Price API V3.
- Mainnet references are Solana xStock mints for NVDAx, AAPLx, MSFTx and GOOGLx; the demo `GOOGx-DEMO` label explicitly maps to the GOOGLx Mainnet reference.
- The reference response includes price, optional 24h change/liquidity/block metadata, observed time, Mainnet network and source metadata.
- Backend uses a short in-memory cache and fails closed when a reliable Mainnet price is unavailable; it does not fall back to hardcoded prices.
- Added `/api/mainnet/prices` to the Render API service.
- `api/devnet/quote.ts` now derives Devnet buy/sell execution pricing from the current Mainnet reference price plus the existing 50 bps demo spread, with 30-second quote expiry.
- Quotes explicitly distinguish `referenceNetwork: mainnet-beta` from `executionNetwork: devnet` and retain Mainnet price provenance.
- Frontend portfolio valuation and rule proposal sizing now use refreshed Mainnet reference prices rather than hardcoded reference values.
- Frontend refreshes Mainnet reference prices every 30 seconds and after trade/rule execution.
- Activity metadata records the Mainnet reference source/observed time alongside Devnet settlement signatures.
- The demo never submits Mainnet trades; all user payments and opposing settlement transfers remain synthetic Devnet transactions.

### Real execution
- User payment is a real wallet-signed Solana Devnet transaction.
- Server settlement verifies exact confirmed token deltas before issuing the opposing Devnet leg.
- Buy and sell are real two-leg Devnet settlement paths.
- Frontend re-reads chain state after confirmed settlement.
- Settlement is retry-safe through `trade_intents` + `quoteId`; repeated settlement requests can reuse an existing confirmed settlement instead of issuing another opposing transfer.

### Complete application UI
- Overview: live Devnet portfolio state, SOL, cash, positions, rules, health and current Mainnet price-source status.
- Discover: synthetic assets plus Mainnet reference prices and real Devnet quote/buy/sell flow.
- Portfolio: persistent portfolio name/description plus confirmed Devnet positions valued with Mainnet references.
- Rules: max allocation, minimum reserve, rebalance threshold, recurring contribution and target allocation controls persisted to Supabase.
- Rule violations produce explicit executable proposals for overweight/underweight assets.
- Every executable proposal requires explicit UI authorization and wallet signing for the real Devnet transaction.
- Activity: persistent audit records and trade lifecycle with Explorer links.
- Passport: wallet, Devnet execution network, Mainnet price source, ownership source, configuration source and proposals.
- All pages use one wallet/session state.

### Persistence/API
- Added protected `/api/data` service-role API for wallet-scoped portfolio/rules/activity/trade lifecycle persistence.
- Browser never receives Supabase service-role credentials.
- Added `src/lib/data.ts` client abstraction.
- Trade intents persist lifecycle statuses including `payment_pending`, `settled`, `failed` and `settlement_pending`.
- Browser data/trade calls honor `VITE_API_BASE_URL`, allowing Vercel frontend traffic to use the dedicated Render API.
- Fixed the rule persistence request to emit one authoritative `ruleType` field.
- Kept `target_allocation` as the wire/database rule type so it matches the live Supabase CHECK constraint and reloads correctly.

### Faucet
- Demo-USDC faucet is a real Devnet market-wallet transfer.
- Server checks Supabase activity history and rate-limits a wallet to one faucet claim per hour.
- Client refreshes chain/data after a successful claim without duplicating the server-side activity record.

### Token-2022 readiness
- Token scanner reads both legacy SPL Token accounts and Token-2022 accounts.
- Execution remains legacy-SPL for the current synthetic Devnet market; Mainnet execution must select the correct token program per asset.

### Execution adapter boundary
- Added `src/lib/execution-adapter.ts`.
- Devnet adapter delegates to the real Devnet quote/settlement implementation.
- Mainnet adapter is explicit and fails closed until a real xStocks/Jupiter-compatible production execution adapter is configured.
- No Mainnet trade is simulated or triggered by the hackathon demo.

### Render
- Separate Render Free web service: `stockpassport-market`.
- URL: `https://stockpassport-market.onrender.com`
- Service ID: `srv-daiaov6k1f9s73bgfpo0`
- Region: Frankfurt.
- Auto-deploy configured from `main`; manual deploys were used when connected auto-deploy lagged behind GitHub pushes.
- `server/index.mjs` exposes `/health`, `/api/data`, `/api/mainnet/prices`, `/api/devnet/quote`, `/api/devnet/faucet`, `/api/devnet/settle`.
- `/health` advertises the Devnet execution network and Mainnet-Jupiter price source.
- Required server-side Mainnet price configuration is documented in `.env.example` (`MAINNET_PRICE_API_URL`, optional `JUPITER_API_KEY`).
- Latest verified live Render deploy before the current commit series is `dep-daikvvnqj5pc73ai1qp0`; the newest `main` commit is currently being deployed as `dep-dail2bm7bikc7393jl9g`.

### CI
- Build workflow runs `npm install` + `npm run build`.
- Historical green run `34665591430` on commit `9de7603ef711089f47163cd3e286283a3943c871` is confirmed.
- Mainnet price-layer run `34666347554` failed on two strict TypeScript issues: optional price narrowing and a duplicate ruleType payload field.
- Fixed the duplicate ruleType field in commit `bf309f59e567971d21e3278902aeb9339940dcb1`.
- Added strict `Number.isFinite` narrowing in commit `29280c2ab92478c995a4616a3e27f68bed1df9d1`.
- Fresh main-branch build run `34696058053` is currently `in_progress`; do not call the newest head green until rechecked.

## Current required configuration
### Render server
- `DEVNET_RPC_URL=https://api.devnet.solana.com`
- `DEVNET_MARKET_KEYPAIR_JSON` — dedicated Devnet market wallet secret; never commit.
- `DEVNET_MARKET_WALLET`
- `DEVNET_CASH_MINT`
- `DEVNET_NVDA_MINT`
- `DEVNET_AAPL_MINT`
- `DEVNET_MSFT_MINT`
- `DEVNET_GOOG_MINT`
- `SUPABASE_URL=https://pwcsnthuvebzfpqprslw.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only secret; never expose in Vite/browser.
- `FRONTEND_ORIGIN` — exact Vercel production origin once the separate StockPassport Vercel project exists.
- `MAINNET_PRICE_API_URL=https://api.jup.ag/price/v3`
- `JUPITER_API_KEY` — optional server-only API key; do not commit or expose to the browser.

### Browser/Vercel
- `VITE_SOLANA_RPC_URL=https://api.devnet.solana.com`
- `VITE_NETWORK=devnet`
- `VITE_API_BASE_URL=https://stockpassport-market.onrender.com`
- `VITE_DEVNET_CASH_MINT`
- `VITE_DEVNET_NVDA_MINT`
- `VITE_DEVNET_AAPL_MINT`
- `VITE_DEVNET_MSFT_MINT`
- `VITE_DEVNET_GOOG_MINT`

## Remaining critical work
1. Verify fresh CI run `34696058053` and latest Render deploy `dep-dail2bm7bikc7393jl9g`.
2. Configure the dedicated Render market wallet, synthetic mint addresses and Supabase service-role key; then verify `/health`, Mainnet prices, quote, faucet, buy and sell with a real Devnet wallet.
3. Create/configure the separate StockPassport Vercel project; existing `agentmarket` must remain untouched.
4. Run complete Devnet lifecycle: faucet → buy → refresh → deliberately trigger rule violation → explicit proposal → wallet-signed rebalance → refresh → Activity/Passport verification.
5. Add signed-wallet authorization to `/api/data` before broad public deployment.
6. Persist the rule proposal lifecycle in `rule_proposals` with proposed/authorized/executed/expired/rejected transitions and execution metadata.
7. Final mobile QA, failure-state QA, security QA and hackathon demo walkthrough.
8. Mainnet execution adapter only after the Devnet demo is stable and a real xStocks/Jupiter-compatible execution route is verified. Until then Mainnet remains price/reference only.

## Guardrails
- No fake balances.
- No client-side private keys.
- Synthetic Devnet assets never presented as real securities.
- Integer/base-unit arithmetic for settlement.
- Network fees separate from trade amounts.
- Every trade exposes exact pay/receive and transaction signatures.
- Quote expiry enforced.
- Devnet market wallet is dedicated and server-only.
- Supabase service-role key remains server-only.
- Solana Devnet remains ownership/transaction source of truth for the demo.
- Solana Mainnet/Jupiter is reference-price truth only for the demo.
- Mainnet execution adapter fails closed when production execution is not configured.
- Rule execution requires explicit user authorization and wallet signing.

## Handoff rule
Update this file after every meaningful milestone with what changed, commit SHA, verification status, remaining blockers, and exact next highest-priority task.
