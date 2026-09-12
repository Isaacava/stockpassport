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
 * as ownership of a real-world equity. Real mint addresses are intentionally
 * not hard-coded until they are verified for the selected environment.
 */
export const DEVNET_ASSETS: StockAsset[] = [
  {
    id: 'nvda-demo',
    symbol: 'NVDAx-DEMO',
    name: 'NVIDIA synthetic demo asset',
    mode: 'synthetic',
    network: 'devnet',
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
    referenceSymbol: 'GOOG',
    decimals: 6,
    quoteCurrency: 'USD',
  },
];

export const DEVNET_CASH_SYMBOL = 'DEMO-USDC';
