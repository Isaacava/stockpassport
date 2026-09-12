# StockPassport Build Log

## Project
- Repo: `Isaacava/stockpassport`
- Product: StockPassport — Solana-native programmable portfolio for synthetic tokenized-stock demo assets on Devnet, with a Mainnet adapter target.
- Current network: Solana Devnet.
- Hackathon window: 6 days remaining from 2026-09-12.

## Architecture
- Vercel: frontend and Vercel-compatible `/api/*` handlers.
- Render Free: separate `stockpassport-market` service for the same API handlers through `server/index.mjs`.
- Supabase Free: dedicated `StockPassport` project for application persistence.
- Solana: authoritative source of token ownership and confirmed transaction state.
- Existing Vercel/Render projects remain untouched.

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
- Security advisor warning for mutable function search path has been fixed.
- Remaining performance advisor messages are RLS init-plan/unused-index optimizations and are not blockers for the MVP.

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

### Real execution
- Quote handler with controlled reference prices, buy/sell spread, 30-second expiry and integer-unit amounts.
- User payment is a real wallet-signed Solana transaction.
- Server settlement verifies exact confirmed token deltas before issuing the opposing leg.
- Buy and sell are real two-leg Devnet settlement paths.
- Frontend re-reads chain state after confirmed settlement.
- Settlement is retry-safe through `trade_intents` + `quoteId`; repeated settlement requests can reuse an existing confirmed settlement instead of issuing another opposing transfer.

### Complete application UI
- Overview: live portfolio valuation, SOL, cash, positions, rule state, health and funding.
- Discover: all synthetic assets plus real quote/buy/sell flow.
- Portfolio: persistent portfolio name/description plus confirmed positions.
- Rules: max allocation, minimum reserve, rebalance threshold and recurring contribution configuration persisted to Supabase.
- Rules now support persisted target allocations per synthetic asset.
- Rule violations now produce explicit executable proposals for overweight/underweight assets.
- Every executable proposal shows an `Authorize & execute` action. The user must explicitly approve in the UI and then sign the real Devnet transaction with the wallet.
- Activity: persisted audit records and trade lifecycle with Explorer links.
- Passport: wallet, network, ownership source, configuration source and current proposals.
- All pages use one wallet/session state instead of isolated demos.

### Persistence/API
- Added protected `/api/data` service-role API for wallet-scoped portfolio/rules/activity/trade lifecycle persistence.
- Browser never receives Supabase service-role credentials.
- Added `src/lib/data.ts` client abstraction.
- Trade intents persist lifecycle status such as `payment_pending`, `settled`, `failed` and `settlement_pending`.
- Browser data/trade calls now honor `VITE_API_BASE_URL`, allowing Vercel frontend traffic to use the dedicated Render API.

### Faucet
- Demo-USDC faucet is a real market-wallet transfer.
- Server checks Supabase activity history and rate-limits a wallet to one faucet claim per hour.
- Client records the resulting activity once; the server no longer duplicates the row.

### Token-2022 readiness
- Token scanner reads both legacy SPL Token accounts and Token-2022 accounts.
- Execution remains legacy-SPL for the current synthetic Devnet market; Mainnet execution must select the correct token program per asset.

### Execution adapter boundary
- Added `src/lib/execution-adapter.ts`.
- Devnet adapter delegates to the real Devnet quote/settlement implementation.
- Mainnet adapter is explicit and fails closed until a real xStocks/Jupiter-compatible production adapter is configured. No Mainnet trade is simulated.

### Render
- Separate Render Free web service: `stockpassport-market`.
- URL: `https://stockpassport-market.onrender.com`
- Service ID: `srv-daiaov6k1f9s73bgfpo0`
- Region: Frankfurt.
- Auto-deploy configured from `main`; first deploy verified live.
- `server/index.mjs` exposes `/health`, `/api/data`, `/api/devnet/quote`, `/api/devnet/faucet`, `/api/devnet/settle`.
- Added strict optional `FRONTEND_ORIGIN` CORS handling and OPTIONS support.
- Latest GitHub pushes after the first Render deploy have not yet produced a newer Render deploy in the connected workspace, so the live service must be re-verified against the latest commit before claiming the newest API code is live.

### CI
- Original CI failure was caused by npm cache requiring a lockfile; cache was removed.
- Token registry type error was fixed.
- UI integration type error (`LocalTrade.quoteId/status`) was fixed.
- Normal CI workflow now runs `npm install` + `npm run build` without the temporary diagnostic step.
- CI run `34665591430` on commit `9de7603ef711089f47163cd3e286283a3943c871` completed successfully after the new AppV2 + API base integration.
- AppV2 and the explicit rules authorization flow are compiler-verified.

## Current required secrets/configuration
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
1. Configure the dedicated Render market wallet secret/public key, synthetic mint addresses and Supabase service-role key; then verify the actual Render service against `/health`, quote, faucet, buy and sell.
2. Create/configure the separate StockPassport Vercel project; the existing `agentmarket` project must remain untouched. The current Vercel connector deploy helper rejected the legacy shorthand arguments and needs the current project/deploy input shape.
3. Run the complete real-wallet Devnet lifecycle: faucet → buy → refresh → rule violation → explicit proposal → wallet-signed rebalance → refresh → Activity/Passport verification.
4. Add signed-wallet authorization to the wallet-scoped `/api/data` service before broad public deployment; address validation alone is not cryptographic identity proof.
5. Add a stronger proposal persistence workflow using `rule_proposals` so generated proposals can be reviewed and marked proposed/authorized/executed rather than existing only in current evaluation state.
6. Final mobile QA, failure-state QA, security QA and hackathon demo walkthrough.
7. Mainnet adapter implementation using verified xStocks/Jupiter infrastructure after Devnet demo is stable.

## Guardrails
- No fake balances.
- No client-side private keys.
- Synthetic Devnet assets never presented as real securities.
- Integer/base-unit arithmetic for settlement.
- Network fees separate from trade amounts.
- Every trade exposes exact pay/receive and transaction signatures.
- Quote expiry enforced.
- Server market wallet must be dedicated Devnet account.
- Service-role database key remains server-only.
- Solana remains ownership/transaction source of truth.
- Mainnet adapter fails closed when production execution is not configured.
- Rule execution requires explicit user authorization and wallet signing.

## Handoff rule
Update this file after every meaningful milestone with what changed, commit SHA, verification status, remaining blockers, and exact next highest-priority task.
