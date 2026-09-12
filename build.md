# StockPassport Build Log

## Project
- Repo: `Isaacava/stockpassport`
- Product: StockPassport — Solana-native programmable portfolio for synthetic tokenized-stock demo assets on Devnet, with a Mainnet adapter target.
- Current network: Solana Devnet.
- Hackathon deadline: 6 days remaining from 2026-09-12.

## Core product decision
StockPassport is focused on **programmable investing portfolios**, not a generic exchange. Users define portfolio behavior, the app evaluates actual holdings, produces deterministic proposals, and only moves funds after explicit authorization.

## Architecture decision — hosting + data
- Vercel: StockPassport frontend and lightweight web delivery.
- Render Hobby: protected Devnet market/settlement service. Existing Render services are untouched.
- Supabase: application database/Auth/persistence metadata. Solana remains the source of truth for ownership and confirmed transactions.
- The existing Vercel and Render projects must not be modified for StockPassport; use separate projects/services.
- Supabase account currently has one active healthy project and one inactive project, so one active Free-project slot remains available. Do not create the new project until the organization is explicitly confirmed for the project-creation action.
- Render account workspace currently contains existing services but remains below the Hobby limit of 25 services.

## Source of truth
- Wallet SOL balance: confirmed Solana RPC.
- Token ownership: confirmed token-account state.
- Frontend state is cache/presentation only.
- Supabase stores application metadata, rules, proposals, trade lifecycle records and audit indexes; it does not replace chain ownership.
- Every confirmed trade must be followed by a fresh on-chain read.
- Failed transactions must not be treated as successful local state changes.

## Devnet asset model
Devnet assets are synthetic demo securities and must always be labeled as such:
- `NVDAx-DEMO`
- `AAPLx-DEMO`
- `MSFTx-DEMO`
- `GOOGx-DEMO`
- `DEMO-USDC`

Mint addresses are injected through Vite environment variables after running the asset bootstrap script.

## Completed
### Wallet/on-chain foundation
- React + TypeScript + Vite scaffold created.
- Solana RPC connection configured for Devnet.
- Wallet connect/disconnect using `window.solana` provider.
- Confirmed SOL balance read.
- Known Devnet synthetic token balances read from SPL token accounts.
- Demo-USDC included in known holdings.
- Explorer wallet links added.
- Explicit warning that synthetic assets are not real equity.

### Devnet asset bootstrap
- `scripts/create-devnet-assets.mjs` creates Demo-USDC and four synthetic stock mints.
- Assets use legacy SPL Token for the current Devnet demo.
- Bootstrap writes mint IDs to `.env.devnet`.

### Real Devnet market foundation
- `api/devnet/quote.ts`: controlled reference prices, buy/sell spread, 30-second quote expiry and integer-unit amounts.
- `api/devnet/settle.ts`: verified two-leg settlement.
- `api/devnet/faucet.ts`: controlled Demo-USDC funding.
- `src/lib/execution.ts`: browser transaction construction, wallet signing, confirmation and settlement handoff.
- Server-side market keypair is never shipped to the browser.
- Buy: user pays Demo-USDC to market, server sends synthetic stock to user.
- Sell: user pays synthetic stock to market, server sends Demo-USDC to user.
- UI records payment and settlement signatures.

### Product UI
- Overview derives portfolio value from confirmed token balances + controlled Devnet reference prices.
- Discover lists synthetic assets and Buy/Sell controls.
- Buy/Sell requests short-lived quotes, displays execution details, requires wallet signing, then refreshes chain state.
- Portfolio shows confirmed positions.
- Activity shows recorded signatures with Explorer links.
- Passport provides audit/identity presentation without duplicating ownership.
- Rules module has been started around deterministic portfolio constraints.

### Rules engine
- Added deterministic rules module for max allocation, minimum cash reserve and rebalance threshold.
- Rules calculate from current observed holdings/reference prices and output proposals only.
- No rule automatically moves user funds without explicit authorization.

### Supabase persistence layer
- Added `supabase/migrations/001_stockpassport_core.sql`.
- Tables cover profiles, portfolios, portfolio rules, rule proposals, trade intents and activity events.
- RLS policies are included so users can only read/write records belonging to their authenticated account where applicable.
- Added `@supabase/supabase-js` dependency.
- Added optional browser client at `src/lib/supabase.ts`.
- Added `.env.example` entries for `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Never place the Supabase service-role key in browser/Vite variables.

### CI
- Initial CI failed because `actions/setup-node` had `cache: npm` but the repo had no lockfile.
- Removed npm cache requirement.
- CI correctly reached `npm install` and then the first real application build.
- Exact TypeScript error was found in `src/lib/tokens.ts`: mixed `Map` entry types for stock assets and Demo-USDC.
- Fixed the typing using an explicit `KnownToken` registry.
- Latest CI run after the fix is currently in progress and has successfully reached `npm install`.
- Temporary diagnostic capture remains in the workflow until a green build is confirmed; remove it after the next successful build.

## Required deployment configuration
### Browser/Vercel
- `VITE_SOLANA_RPC_URL=https://api.devnet.solana.com`
- `VITE_NETWORK=devnet`
- `VITE_DEVNET_CASH_MINT`
- `VITE_DEVNET_NVDA_MINT`
- `VITE_DEVNET_AAPL_MINT`
- `VITE_DEVNET_MSFT_MINT`
- `VITE_DEVNET_GOOG_MINT`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Render server
- `DEVNET_RPC_URL`
- `DEVNET_MARKET_KEYPAIR_JSON` — dedicated funded Devnet market wallet secret key; NEVER expose client-side.
- `DEVNET_MARKET_WALLET`
- `DEVNET_CASH_MINT`
- `DEVNET_NVDA_MINT`
- `DEVNET_AAPL_MINT`
- `DEVNET_MSFT_MINT`
- `DEVNET_GOOG_MINT`
- Supabase server credentials only on Render if needed for settlement persistence; never expose service-role credentials client-side.

## Next build sequence — highest priority
1. Confirm the newest CI run is green and remove temporary diagnostic capture.
2. Add Render-compatible HTTP server for `/quote`, `/faucet`, `/settle`, `/health` using the existing Devnet settlement logic.
3. Make settlement idempotent using the Supabase `trade_intents` lifecycle and quote IDs so retries cannot double-settle.
4. Create the dedicated StockPassport Supabase project after organization confirmation and apply the migration.
5. Deploy the Render settlement service and configure secrets.
6. Connect Vercel frontend to Render API and Supabase.
7. Execute a real Devnet funding → buy → sell flow and verify every signature/balance on-chain.
8. Finish rules UI and explicit rebalance execution.
9. Expand Activity from local browser cache toward persisted/chain-indexed history.
10. Add Mainnet adapter boundary + Token-2022 support + verified reference/oracle pricing.
11. Final mobile QA, failure-state QA, security review, demo path and hackathon submission polish.

## Guardrails
- No fake balances.
- No client-side private keys.
- No real-security claims for synthetic Devnet assets.
- Use integer/base-unit arithmetic for token amounts and prices.
- Network fees are separate from trade amounts.
- Every trade shows exact pay/receive/fee/status.
- Quote expiry must be enforced.
- Market wallet must be a dedicated Devnet account, not a personal wallet.
- Public endpoints must not expose the market wallet secret.
- Mainnet asset code must support Token-2022 as well as legacy SPL where required.
- Two-leg settlement must expose intermediate state and be retry/idempotency safe.

## Known limitations not yet solved
- Current token scanner only checks legacy SPL Token; Mainnet must also support Token-2022.
- Wallet integration currently uses `window.solana`; later harden with Wallet Standard/adapter support.
- Devnet reference prices are controlled demo values; production/mainnet should use verified market/oracle data.
- Two-leg settlement is not atomic.
- Public faucet needs abuse/rate controls before broad deployment.
- Supabase project creation is pending explicit organization confirmation.
- Vercel deployment has not yet been created for this repo.
- Render StockPassport settlement service has not yet been created.

## Current commits / checkpoints
- CI fix: `5379dd6d914058041eb7e19e43d0100db2e3563b`
- Devnet quote: `edcfc59d357fc6336da1809e7305e20a50df1f6f`
- Devnet settlement: `2c115dd0428191e0a1c541ae3b24c266450746df`
- Browser execution client: `346dc03f64f816212c0076a2c53ae5c39f463f0f`
- Demo faucet: `fdef18f0529a49f73d41478b6698f8fa79087490`
- Demo-USDC holdings: `3e8f7e9c9b61ddb1565642d33e4b0dfc30c85635`
- Trading UI: `0b48a275fe5639616238b48f1ae9e70ab925c8b3`
- Rules engine: `34d6a266630831fbfc70467f99daaf07e41de89f`
- Token type fix: `55d8a36e7d8d948b0c38e1f5778b1148cf434da3`
- Supabase dependency: `e98383e5ddecf6dddf513acde0272699af1b6ab1`
- Supabase schema: `7dfb1f7d49e3676ba6aa87afbd236e229fd188ac`
- Supabase browser client: `7a4c212a855e318445b69c494d13f10562c253a5`
- Environment config: `d32e219a150c8dc5fd68c09d2f6ac1fd6e52ac96`

## Handoff rule
Update this file after every meaningful milestone with:
- what changed;
- commit SHA when known;
- what was verified;
- what remains broken;
- the exact next highest-priority task.
