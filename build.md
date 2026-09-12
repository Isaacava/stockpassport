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
- Settlement is now retry-safe through `trade_intents` + `quoteId`; repeated settlement requests can reuse an existing confirmed settlement instead of issuing another opposing transfer.
- Redundant settlement lookup code was removed.

### Complete application UI
- Overview: live portfolio valuation, SOL, cash, positions, rule state, health and funding.
- Discover: all synthetic assets plus real quote/buy/sell flow.
- Portfolio: persistent portfolio name/description plus confirmed positions.
- Rules: max allocation, minimum reserve, rebalance threshold and recurring contribution configuration persisted to Supabase.
- Activity: persisted audit records and trade lifecycle with Explorer links.
- Passport: wallet, network, ownership source, configuration source and current proposals.
- All pages use one wallet/session state instead of isolated demos.

### Persistence/API
- Added protected `/api/data` service-role API for wallet-scoped portfolio/rules/activity/trade lifecycle persistence.
- Browser never receives Supabase service-role credentials.
- Added `src/lib/data.ts` client abstraction.
- Trade intents persist lifecycle status such as `payment_pending`, `settled`, `failed` and `settlement_pending`.

### Faucet
- Demo-USDC faucet is a real market-wallet transfer.
- Server now checks Supabase activity history and rate-limits a wallet to one faucet claim per hour.
- Client remains responsible for recording the resulting activity once; server does not duplicate the activity row.

### Token-2022 readiness
- Token scanner now reads both legacy SPL Token accounts and Token-2022 accounts.
- Verified Token-2022 program ID is used in the scanner.
- Execution remains legacy-SPL for the current synthetic Devnet market; Mainnet execution must select the correct token program per asset.

### Execution adapter boundary
- Added `src/lib/execution-adapter.ts`.
- Devnet adapter delegates to the real Devnet quote/settlement implementation.
- Mainnet adapter is explicit and fails closed until a real xStocks/Jupiter-compatible production adapter is configured. No Mainnet trade is simulated.

### Render
- Separate Render Free web service created: `stockpassport-market`.
- URL: `https://stockpassport-market.onrender.com`
- Service ID: `srv-daiaov6k1f9s73bgfpo0`
- Region: Frankfurt.
- Auto-deploy from `main`.
- First deploy verified `live` at deploy id `dep-daiaovuk1f9s73bgfrhg`.
- `server/index.mjs` exposes `/health`, `/api/data`, `/api/devnet/quote`, `/api/devnet/faucet`, `/api/devnet/settle` using the same handler modules as Vercel.
- Public non-secret configuration is set. Private market and Supabase service credentials still need to be entered before real Render-side settlement can run.

### CI
- Original CI failure was caused by npm cache requiring a lockfile; cache was removed.
- Token registry type error was fixed.
- UI integration type error (`LocalTrade.quoteId/status`) was fixed.
- CI run `34665377319` on commit `04f9d380830d4ce4daf660f58aa69266944c13b9` completed successfully.
- The temporary diagnostic capture has now been removed from `.github/workflows/build.yml`.
- Latest subsequent commits are building through the normal `npm install` + `npm run build` workflow.

## Current required secrets/configuration
### Vercel or Render server
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

### Browser/Vercel
- `VITE_SOLANA_RPC_URL=https://api.devnet.solana.com`
- `VITE_NETWORK=devnet`
- `VITE_DEVNET_CASH_MINT`
- `VITE_DEVNET_NVDA_MINT`
- `VITE_DEVNET_AAPL_MINT`
- `VITE_DEVNET_MSFT_MINT`
- `VITE_DEVNET_GOOG_MINT`

## Remaining critical work
1. Put the dedicated Devnet market secret/public key and synthetic mint addresses into Render server secrets and confirm the market wallet actually has Demo-USDC + stock inventory.
2. Create/configure the separate StockPassport Vercel project; the current connected Vercel project is only `agentmarket` and must remain untouched.
3. Perform the full real-wallet lifecycle on Devnet: faucet → buy → fresh chain read → sell → fresh chain read → persistent Activity/Passport verification.
4. Upgrade Rules from proposal-only evaluation to explicit user-authorized rebalance execution using the same quote/sign/settle adapter.
5. Add target-allocation controls so the rules engine can generate meaningful buy-underweight and sell-overweight proposals, not only cap/reserve violations.
6. Harden wallet-scoped `/api/data` writes with signed-wallet authorization before public production use; current server endpoints validate wallet addresses but service-role API calls are not cryptographically authenticated by wallet signature yet.
7. Final mobile QA, failure-state QA, security QA and hackathon demo walkthrough.
8. Mainnet adapter implementation using verified xStocks/Jupiter infrastructure after Devnet demo is stable.

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

## Handoff rule
Update this file after every meaningful milestone with what changed, commit SHA, verification status, remaining blockers, and exact next highest-priority task.
