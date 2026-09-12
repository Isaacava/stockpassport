# StockPassport

StockPassport is a Solana-native programmable portfolio for tokenized stocks.

## Product direction

The hackathon MVP focuses on one wedge: **programmable investing**.

Users can:

- discover tokenized stocks and their metadata
- connect a Solana wallet
- read portfolio state from on-chain token accounts
- build target allocations
- define portfolio rules
- receive portfolio/event alerts
- review executable actions
- sign real Devnet transactions
- verify the resulting transaction and on-chain balances

## Devnet-first architecture

The Devnet environment uses synthetic, clearly-labelled test assets while consuming live/reference equity market data where available. Devnet asset ownership and settlement are real Solana state; the synthetic assets are not claims on real-world securities.

Production mode is designed around existing Solana tokenized-stock and execution infrastructure rather than rebuilding a market primitive.

## Source of truth

- Wallet/token-account state: Solana
- Reference market data: oracle/market-data adapters
- Executable quotes: execution adapter
- Portfolio rules: StockPassport domain logic
- UI cache: non-authoritative

## Anti-AI-slop product rule

The interface should be restrained, product-first, mobile-first and information-dense without decorative noise. No gratuitous gradients, glassmorphism, fake 3D, oversized rounded cards, novelty typography, or ornamental dashboards.

## Status

Foundation setup in progress.
