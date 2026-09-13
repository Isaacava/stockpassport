# StockPassport build status

## Current architecture
- Vercel hosts the React/Vite app and same-origin `/api/*` serverless functions.
- Supabase stores portfolio, rules, trade intents, and activity history.
- Solana Devnet handles all user-facing synthetic asset execution and faucet transfers.
- Mainnet market data is reference-only; it is never traded by StockPassport.

## Devnet market wallet
Public address:
`4JuZbuYNvoC2sZLGGdeP9fSyq5NqRBRaK8eLCb2uiRBf`

Private key must be configured only as the Vercel server variable `DEVNET_MARKET_PRIVATE_KEY`. It must not be committed to Git.

## Synthetic assets
The intended fixed supplies are 1,000,000,000 units each, with 6 decimals:
- DEMO-USDC
- NVDAx-DEMO
- AAPLx-DEMO
- MSFTx-DEMO
- GOOGx-DEMO

The creation script places the full supply in the market wallet and revokes mint authority after minting.

## Faucet behavior
- DEMO-USDC faucet: unlimited claims; each claim sends 1,000 DEMO-USDC from the market wallet.
- SOL faucet: unlimited claims; each claim sends 0.1 SOL from the market wallet.
- Claims are recorded in Supabase activity history when Supabase credentials are configured.

## Required Vercel variables
Browser:
- VITE_REOWN_PROJECT_ID
- VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
- VITE_NETWORK=devnet
- VITE_API_BASE_URL (blank in production)
- VITE_DEVNET_CASH_MINT
- VITE_DEVNET_NVDA_MINT
- VITE_DEVNET_AAPL_MINT
- VITE_DEVNET_MSFT_MINT
- VITE_DEVNET_GOOG_MINT
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY

Server:
- DEVNET_RPC_URL=https://api.devnet.solana.com
- MAINNET_PRICE_API_URL=https://api.jup.ag/price/v3
- JUPITER_API_KEY (when required by the configured Jupiter endpoint)
- QUOTE_SIGNING_SECRET
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- DEVNET_MARKET_WALLET
- DEVNET_MARKET_PRIVATE_KEY
- DEVNET_CASH_MINT
- DEVNET_NVDA_MINT
- DEVNET_AAPL_MINT
- DEVNET_MSFT_MINT
- DEVNET_GOOG_MINT

## End-to-end flow
1. Connect a Solana wallet with Reown.
2. Sign into the StockPassport portfolio.
3. Claim Devnet DEMO-USDC and SOL from the faucet.
4. Read Mainnet reference price.
5. Request a signed Devnet quote.
6. User authorizes the payment transaction in their wallet.
7. Vercel verifies the confirmed payment amount and destination.
8. Market wallet transfers the synthetic security or DEMO-USDC back to the user.
9. Supabase records the trade and settlement signatures.
10. Portfolio, history, and passport views refresh from Devnet state and Supabase history.

## Remaining deployment step
The code expects the Vercel environment variables above. The actual secret values and newly created mint addresses must be entered in the StockPassport Vercel project before runtime testing.
