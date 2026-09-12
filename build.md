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
- `api/devnet/quote.ts` derives Devnet buy/sell execution pricing from the current Mainnet reference price plus the existing 50 bps demo spread, with 30-second quote expiry.
- Quotes explicitly distinguish `referenceNetwork: mainnet-beta` from `executionNetwork: devnet` and retain Mainnet price provenance.
- Frontend portfolio valuation and rule proposal sizing now use refreshed Mainnet reference prices rather than hardcoded reference values.
- Frontend refreshes Mainnet reference prices every 30 seconds and after trade/rule execution.
- Activity metadata records the Mainnet reference source/observed time alongside Devnet settlement signatures.
- The demo never submits Mainnet trades; all user payments and opposing settlement transfers remain synthetic Devnet transactions.
- Signed-quote protection authenticates exact asset/cash amounts and quote expiry with `QUOTE_SIGNING_SECRET`.
- Removed legacy hardcoded settlement prices from `api/devnet/settle.ts`; settlement now accepts only a valid server-signed quote.

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
- `/api/data` returns wallet-scoped `rule_proposals` alongside portfolio/rule/activity/trade state.
- Added durable proposal recording and update endpoints for `proposed`, `authorized`, `executed`, `expired` and `rejected` states.
- Proposal reads lazily expire stale `proposed`/`authorized` records whose `expires_at` has passed.
- Protected proposal create/update mutations with the same recent Ed25519 wallet authorization used for portfolio/rule writes.
- `src/lib/data.ts` now exposes typed `PersistedProposal`, `recordRuleProposal`, and `updateRuleProposal` helpers.
- Portfolio and rule mutation calls require a recent Ed25519 wallet message signature matching the exact request body; normal trade/activity writes are not prompted for extra message signatures.
- Server verifies the Solana wallet public key and signature using Node's native Ed25519 verification before changing protected metadata.
- Trade intents persist lifecycle statuses including `payment_pending`, `settled`, `failed` and `settlement_pending`.
- Browser data/trade calls honor `VITE_API_BASE_URL`, allowing Vercel frontend traffic to use the dedicated Render API.
- Fixed the rule persistence request to emit one authoritative `ruleType` field.
- Kept `target_allocation` as the wire/database rule type so it matches the live Supabase CHECK constraint and reloads correctly.

### Faucet
- Demo-USDC faucet remains a real Devnet market-wallet token transfer with one claim per hour per wallet.
- Added a separate `public/faucet/index.html` page dedicated to claiming free Devnet SOL; it is intentionally separate from the portfolio/trading UI.
- The SOL faucet pays `0.1 SOL` per successful claim, once per hour per wallet.
- Added `api/devnet/sol-faucet.ts`, which transfers real Devnet SOL from the dedicated server-side market wallet and records `sol_faucet` activity for rate limiting/audit history.
- Faucet UI shows wallet, Devnet network, current balance, claim status and a Solana Explorer link after confirmation.
- The page targets the dedicated Render API endpoint explicitly so it remains functional when the frontend is hosted separately on Vercel.
- The SOL faucet is explicitly labelled Devnet-only and never represents mainnet SOL value.

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
- `server/index.mjs` exposes `/health`, `/api/data`, `/api/mainnet/prices`, `/api/devnet/quote`, `/api/devnet/faucet`, `/api/devnet/sol-faucet`, `/api/devnet/settle`.
- `/health` advertises the Devnet execution network and Mainnet-Jupiter price source.
- Required server-side Mainnet price configuration is documented in `.env.example`.
- Required server-side quote secret: `QUOTE_SIGNING_SECRET`.
- Render logs verified clean restarts on the latest deployed code before this proposal-lifecycle commit.

### CI
- Build workflow runs `npm install` + `npm run build`.
- `34697023682` on commit `541993245aa30fa64b64db9822283dbb5bcba938` completed successfully.
- `34697033674` on commit `1676beabc008003c9ebdc2959fc96240f17b3aaa` completed successfully.
- `34697102059` on commit `33e618f3c93eeee3976ae48fce9f94f1c88d8012` completed successfully.
- A new CI run will verify the current proposal-lifecycle client/API changes.

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
- `QUOTE_SIGNING_SECRET` — random high-entropy server-only secret used to authenticate Devnet execution quotes.

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
1. Create/configure the separate StockPassport Vercel project; existing `agentmarket` must remain untouched.
2. Configure the dedicated Render market wallet, synthetic mint addresses, Supabase service-role key and `QUOTE_SIGNING_SECRET`; then verify `/health`, Mainnet prices, signed quote, SOL faucet, token faucet, buy and sell with a real Devnet wallet.
3. Wire the existing Rules UI's in-memory proposal authorization to `recordRuleProposal`/`updateRuleProposal` so the full proposed → authorized → executed path is visible in the durable database.
4. Run complete Devnet lifecycle: SOL faucet → token faucet → buy → refresh → deliberately trigger rule violation → explicit proposal → wallet-signed rebalance → refresh → Activity/Passport verification.
5. Final mobile QA, failure-state QA, security QA and hackathon demo walkthrough.
6. Mainnet execution adapter only after the Devnet demo is stable and a real xStocks/Jupiter-compatible execution route is verified. Until then Mainnet remains price/reference only.
7. Final setup handoff: provide the complete list of required accounts, environment variables, Devnet wallets/mints, Supabase setup, Vercel configuration, Render configuration and deployment steps only after the live lifecycle is verified.

## Guardrails
- No fake balances.
- No client-side private keys.
- Synthetic Devnet assets never presented as real securities.
- Integer/base-unit arithmetic for settlement.
- Network fees separate from trade amounts.
- Every trade exposes exact pay/receive and transaction signatures.
- Quote expiry enforced.
- Quote amounts are server-signed before settlement.
- Devnet market wallet is dedicated and server-only.
- Supabase service-role key remains server-only.
- Portfolio/rule/proposal metadata writes require wallet-signature authorization.
- Solana Devnet remains ownership/transaction source of truth for the demo.
- Solana Mainnet/Jupiter is reference-price truth only for the demo.
- Mainnet execution adapter fails closed when production execution is not configured.
- Rule execution requires explicit user authorization and wallet signing.
- Devnet faucet claims are explicitly separate from any Mainnet asset or value.

## Handoff rule
Update this file after every meaningful milestone with what changed, commit SHA, verification status, remaining blockers, and exact next highest-priority task.
