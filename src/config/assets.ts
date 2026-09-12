export type Network = 'devnet' | 'mainnet-beta';

export type AssetMode = 'synthetic' | 'real';

export type StockAsset = {
  id: string;
  symbol: string;
  name: string;
  mode: AssetMode;
  network: Network;
  mint?: string;
  referenceSymbol: string;
  decimals: number;
  quoteCurrency: 'USD';
};

/**
 * Devnet assets are synthetic test securities. They must never be presented
 * as ownership of a real-world equity. Mint addresses are injected through
 * Vite environment variables only after the corresponding Devnet mints exist.
 */
export const DEVNET_ASSETS: StockAsset[] = [
  {
    id: 'nvda-demo',
    symbol: 'NVDAx-DEMO',
    name: 'NVIDIA synthetic demo asset',
    mode: 'synthetic',
    network: 'devnet',
    mint: import.meta.env.VITE_DEVNET_NVDA_MINT || undefined,
    referenceSymbol: 'NVDA',
    decimals: 6,
    quoteCurrency: 'USD',
  },
  {
    id: 'aapl-demo',
    symbol: 'AAPLx-DEMO',
    name: 'Apple synthetic demo asset',
    mode: 'synthetic',
    network: 'devnet',
    mint: import.meta.env.VITE_DEVNET_AAPL_MINT || undefined,
    referenceSymbol: 'AAPL',
    decimals: 6,
    quoteCurrency: 'USD',
  },
  {
    id: 'msft-demo',
    symbol: 'MSFTx-DEMO',
    name: 'Microsoft synthetic demo asset',
    mode: 'synthetic',
    network: 'devnet',
    mint: import.meta.env.VITE_DEVNET_MSFT_MINT || undefined,
    referenceSymbol: 'MSFT',
    decimals: 6,
    quoteCurrency: 'USD',
  },
  {
    id: 'goog-demo',
    symbol: 'GOOGx-DEMO',
    name: 'Alphabet synthetic demo asset',
    mode: 'synthetic',
    network: 'devnet',
    mint: import.meta.env.VITE_DEVNET_GOOG_MINT || undefined,
    referenceSymbol: 'GOOG',
    decimals: 6,
    quoteCurrency: 'USD',
  },
];

export const DEVNET_CASH_SYMBOL = 'DEMO-USDC';
export const DEVNET_CASH_MINT = import.meta.env.VITE_DEVNET_CASH_MINT || undefined;
