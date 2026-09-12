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
- Portfolio records now have wallet-native ownership metadata.
- `set_updated_at` trigger function has fixed `search_path`.
- Foreign-key indexes were added for activity/trade user IDs.
- Security advisor warning for mutable function search path has been fixed.
- Remaining performance advisor messages are mostly RLS init-plan optimizations and unused-index info; they are not blockers for the hackathon MVP.

## Completed product foundation
### Wallet/on-chain
- React + TypeScript + Vite scaffold.
- Devnet RPC connection and confirmed SOL reads.
- Wallet connect/disconnect using `window.solana` signing provider.
- Confirmed synthetic token-account discovery.
- Explorer address/transaction links.
- Synthetic assets always labelled as demo securities.

### Devnet assets
- Demo-USDC plus NVDAx-DEMO, AAPLx-DEMO, MSFTx-DEMO and GOOGx-DEMO.
- Bootstrap script creates deterministic synthetic assets and writes mint configuration.
- Legacy SPL Token is used for the current Devnet demo.

### Real execution
- Quote handler with controlled reference prices, buy/sell spread, 30-second expiry and integer-unit amounts.
- User payment is a real wallet-signed Solana transaction.
- Server settlement verifies exact confirmed token deltas before issuing the opposing leg.
- Buy and sell are both real two-leg Devnet settlement paths.
- Frontend re-reads chain state after confirmed settlement.

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
- Trade intents persist status transitions such as `payment_pending`, `settled`, `failed` and `settlement_pending`.

### Render
- Separate Render Free web service created: `stockpassport-market`.
- URL: `https://stockpassport-market.onrender.com`
- Service ID: `srv-daiaov6k1f9s73bgfpo0`
- Region: Frankfurt.
- Auto-deploy from `main`.
- `server/index.mjs` exposes `/health`, `/api/data`, `/api/devnet/quote`, `/api/devnet/faucet`, `/api/devnet/settle` using the same handler modules as Vercel.
- Public non-secret configuration is set; private market/Supabase service credentials still need to be entered as Render secrets before real settlement can run there.

## CI status
- Original CI failure was caused by npm cache requiring a lockfile; cache was removed.
- A green build was previously achieved after fixing `src/lib/tokens.ts` token registry typing.
- A later UI integration run failed on an older commit because `LocalTrade` was missing `quoteId/status` in that commit.
- That type was corrected in commit `d3508948a69c0d9375e569399a1d92925b706c4d`.
- The latest CI run on commit `9b7a9ce0a8be121353084bff0586ae53fb996f48` is currently in progress after adding Render start support.
- Do not call the current main build green until that latest run completes successfully.

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
- `SUPABASE_URL=https://pwcsnthuvebzfpqprslw`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only secret; never expose in Vite/browser.

### Browser
- `VITE_SOLANA_RPC_URL=https://api.devnet.solana.com`
- `VITE_NETWORK=devnet`
- `VITE_DEVNET_CASH_MINT`
- `VITE_DEVNET_NVDA_MINT`
- `VITE_DEVNET_AAPL_MINT`
- `VITE_DEVNET_MSFT_MINT`
- `VITE_DEVNET_GOOG_MINT`

## Next highest-priority tasks
1. Confirm newest CI run green and remove temporary build diagnostic capture.
2. Finish settlement idempotency using `trade_intents` so retrying the same quote/payment never issues a second opposing transfer.
3. Finish faucet server rate guard and avoid duplicate faucet activity writes.
4. Configure Render private secrets and verify `/health`, quote, funding, buy and sell paths against live Devnet state.
5. Create/configure separate Vercel project deployment and environment variables.
6. Run a complete real-wallet lifecycle: fund → buy → refresh → rule violation → proposal → sell/rebalance → refresh → verify activity/passport.
7. Implement explicit rebalance authorization/execution instead of proposal-only state.
8. Expand token scanner to support Token-2022 for future Mainnet assets.
9. Add a production asset/execution adapter boundary for real xStocks/Jupiter integration.
10. Final mobile QA, failure-state QA, security QA and hackathon demo walkthrough.

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

## Handoff rule
Update this file after every meaningful milestone with what changed, verification status, remaining blockers, and the next highest-priority task.
