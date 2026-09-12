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
- Explorer wallet links added.
- Explicit warning that synthetic assets are not real equity.

### Devnet asset bootstrap
- `scripts/create-devnet-assets.mjs` creates Demo-USDC and four synthetic stock mints.
- Assets use legacy SPL Token for the current Devnet demo.
- Bootstrap writes mint IDs to `.env.devnet`.

### CI
- Initial CI failed because `actions/setup-node` had `cache: npm` but the repo had no lockfile.
- Fixed `.github/workflows/build.yml` by removing npm cache until a lockfile is intentionally committed.
- Latest CI run is currently queued on commit `5379dd6d914058041eb7e19e43d0100db2e3563b`.

### GitHub issues
- #1 Wallet and on-chain balance layer.
- #2 Synthetic Devnet asset environment.
- #3 Devnet execution adapter.
- #4 Portfolio state and programmable rules engine.

## Current implementation in progress
### Real Devnet execution
The Devnet demo will use a **server-side market/issuer wallet** stored only in deployment secrets. It is never shipped to the browser.

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

## Required server secrets
- `DEVNET_RPC_URL`
- `DEVNET_MARKET_KEYPAIR_JSON` — funded Devnet market wallet secret key; NEVER expose client-side.
- `DEVNET_CASH_MINT`
- `DEVNET_NVDA_MINT`
- `DEVNET_AAPL_MINT`
- `DEVNET_MSFT_MINT`
- `DEVNET_GOOG_MINT`

## Next build sequence (highest priority)
1. Finish Devnet market API: quote, faucet/funding, buy settlement, sell settlement.
2. Build browser execution client with transaction-signing and confirmation.
3. Add Discover + Buy/Sell UI.
4. Add portfolio valuation using demo reference prices.
5. Add rules engine: max allocation, minimum reserve, rebalance threshold, deterministic proposal output.
6. Add explicit rebalance execution using the same execution adapter.
7. Add Activity/transaction history with signatures and explorer links.
8. Add Passport summary and audit timeline.
9. Add Mainnet adapter boundary and xStocks/Jupiter integration stub without pretending Mainnet execution is already complete.
10. Final demo polish, error handling, mobile QA, security review, and hackathon README/demo flow.

## Guardrails
- No fake balances.
- No client-side private keys.
- No real-security claims for synthetic Devnet assets.
- Use integer/base-unit arithmetic for token amounts and prices.
- Network fees are separate from trade amounts.
- Every trade shows exact pay/receive/fee/status.
- Quote expiry must be enforced.
- Market wallet must be a dedicated Devnet account, not a personal wallet.
- Mainnet asset code must support Token-2022 as well as legacy SPL where required.

## Known limitations not yet solved
- Current token scanner only checks the legacy SPL Token program; Mainnet support must also understand Token-2022 accounts.
- Wallet integration currently uses `window.solana`; later harden with a Wallet Standard/adapter approach for broader mobile compatibility.
- Reference prices are initially controlled Devnet demo prices; a production/mainnet build should consume a verified live market/oracle source.
- The current UI still has scaffolded Discover/Portfolio/Rules/Activity modules.

## Handoff rule
Update this file after every meaningful milestone with:
- what changed;
- commit SHA when known;
- what was verified;
- what remains broken;
- the exact next highest-priority task.
