# StockPassport Build Log

## Project
- Repo: `Isaacava/stockpassport`
- Product: StockPassport — Solana-native programmable portfolio for tokenized-stock assets.
- Current network: Solana Devnet.
- Mainnet target: real tokenized-stock infrastructure (xStocks/Jupiter or compatible execution adapter).
- Hackathon deadline: 6 days remaining from 2026-09-12.

## Core product decision
StockPassport is focused on **programmable investing portfolios**, not a generic exchange. The differentiator is the rules layer: users define portfolio behavior, the app evaluates actual holdings, creates deterministic proposals, and only moves funds after explicit authorization.

## Source of truth
- Wallet SOL balance: confirmed Solana RPC.
- Token ownership: confirmed SPL token-account state.
- Frontend state is cache/presentation only.
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
- Demo-USDC is now included in the known holdings map.
- Explorer wallet links added.
- Explicit warning that synthetic assets are not real equity.

### Devnet asset bootstrap
- `scripts/create-devnet-assets.mjs` creates Demo-USDC and four synthetic stock mints.
- Assets use legacy SPL Token for the current Devnet demo.
- Bootstrap writes mint IDs to `.env.devnet`.

### CI
- Initial CI failed because `actions/setup-node` had `cache: npm` but the repo had no lockfile.
- Fixed `.github/workflows/build.yml` by removing npm cache.
- CI now passes setup/checkout/node and reaches `npm install`; the newest run was still in progress at the last check.
- Important: a green CI build has not yet been confirmed after the new application code.

### Real Devnet market foundation
- Added `api/devnet/quote.ts` with controlled Devnet reference prices, buy/sell spread, 30-second quote expiry and integer-unit amounts.
- Added `api/devnet/settle.ts` for verified two-leg settlement.
- Added `api/devnet/faucet.ts` for controlled 1,000 Demo-USDC funding.
- Added `src/lib/execution.ts` to build/sign/submit user payment transactions and call server settlement.
- Server-side market keypair is never shipped to the browser.
- Settlement verifies confirmed transaction deltas by mint + owner before releasing the opposing asset.
- Buy flow: user sends Demo-USDC to market, server sends synthetic stock to user.
- Sell flow: user sends synthetic stock to market, server sends Demo-USDC to user.
- UI records both payment and settlement signatures.

### Product UI milestone
- Overview now derives portfolio value from confirmed token balances + controlled Devnet reference prices.
- Discover now lists all synthetic assets and includes Buy/Sell controls.
- Buy/Sell flow requests a short-lived quote, shows execution price/spread/amount, requires wallet signing, then re-reads chain state.
- Portfolio page now shows confirmed positions.
- Activity page shows locally indexed trade/funding signatures with Solana Explorer links.
- Passport page provides the audit/identity layer without duplicating token ownership.
- Rules page establishes the next programmable portfolio milestone.

### Persistent handoff
- `build.md` created as the canonical continuation log.
- This file must be updated after every meaningful milestone.

## Current implementation in progress
### Real Devnet execution
The Devnet demo uses a **server-side market/issuer wallet** stored only in deployment secrets. It is never shipped to the browser.

Trade flow:
1. Browser requests a quote from the Devnet market API.
2. User reviews exact pay/receive quantities and quote expiry.
3. User wallet signs the payment transfer to the market wallet.
4. Server confirms that exact payment transaction on Solana and verifies mint, source wallet, destination wallet, and amount.
5. Server signs the synthetic asset transfer from the market wallet to the user's associated token account.
6. Frontend waits for confirmation and then re-reads balances from Solana.
7. UI records both transaction signatures and explorer links.

Sell is the reverse:
1. User signs the synthetic stock transfer to the market wallet.
2. Server verifies the exact stock payment on-chain.
3. Server sends exact Demo-USDC proceeds to the user.
4. Frontend re-reads on-chain state.

This is intentionally two-leg rather than pretending to be an atomic exchange. The UI must clearly show the settlement status of each leg.

## Required deployment configuration
### Browser/Vite
- `VITE_SOLANA_RPC_URL=https://api.devnet.solana.com`
- `VITE_NETWORK=devnet`
- `VITE_DEVNET_CASH_MINT`
- `VITE_DEVNET_NVDA_MINT`
- `VITE_DEVNET_AAPL_MINT`
- `VITE_DEVNET_MSFT_MINT`
- `VITE_DEVNET_GOOG_MINT`

### Server
- `DEVNET_RPC_URL`
- `DEVNET_MARKET_KEYPAIR_JSON` — dedicated funded Devnet market wallet secret key; NEVER expose client-side.
- `DEVNET_MARKET_WALLET`
- `DEVNET_CASH_MINT`
- `DEVNET_NVDA_MINT`
- `DEVNET_AAPL_MINT`
- `DEVNET_MSFT_MINT`
- `DEVNET_GOOG_MINT`

## Next build sequence (highest priority)
1. Confirm GitHub Actions `npm install` + `npm run build` on the current application code and fix every compile error.
2. Add the controlled Devnet market-wallet setup instructions/script and verify the market wallet has inventory for cash + synthetic stocks.
3. Add a safe Devnet funding/risk guard so the faucet cannot be used as an unlimited public drain.
4. Build rules engine: max allocation, minimum reserve, rebalance threshold, deterministic proposal output.
5. Implement explicit rebalance execution using the same execution adapter.
6. Expand activity from local cache toward chain-derived transaction discovery.
7. Add Mainnet adapter boundary and Token-2022 support without pretending Mainnet execution is complete.
8. Connect verified market/oracle reference prices while retaining a deterministic Devnet fallback.
9. Final mobile QA, failure-state QA, security review, demo path and README/hackathon submission polish.

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

## Known limitations not yet solved
- Current token scanner only checks the legacy SPL Token program; Mainnet support must also understand Token-2022 accounts.
- Wallet integration currently uses `window.solana`; later harden with a Wallet Standard/adapter approach for broader mobile compatibility.
- Reference prices are initially controlled Devnet demo prices; a production/mainnet build should consume a verified live market/oracle source.
- Two-leg settlement is not atomic; the UI must show the intermediate payment-confirmed / settlement-pending state clearly.
- Public faucet needs abuse/rate controls before a broad demo deployment.
- Server-side settlement endpoint should eventually persist quote/settlement IDs to prevent replay across retries.

## Current commits / checkpoints
- CI fix: `5379dd6d914058041eb7e19e43d0100db2e3563b`
- Build log: `fc6513e795d532b97c413ac9b35ffd75eadf0668`
- Devnet quote: `edcfc59d357fc6336da1809e7305e20a50df1f6f`
- Devnet settlement: `2c115dd0428191e0a1c541ae3b24c266450746df`
- Browser execution client: `346dc03f64f816212c0076a2c53ae5c39f463f0f`
- Demo faucet: `fdef18f0529a49f73d41478b6698f8fa79087490`
- Demo-USDC holdings: `3e8f7e9c9b61ddb1565642d33e4b0dfc30c85635`
- Trading UI: `0b48a275fe5639616238b48f1ae9e70ab925c8b3`
- Latest style update: `c0cc11f0e2af0eb19df0980933f5025e28571899`

## Handoff rule
Update this file after every meaningful milestone with:
- what changed;
- commit SHA when known;
- what was verified;
- what remains broken;
- the exact next highest-priority task.
