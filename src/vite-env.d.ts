/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_RPC_URL?: string;
  readonly VITE_NETWORK?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEVNET_CASH_MINT?: string;
  readonly VITE_DEVNET_NVDA_MINT?: string;
  readonly VITE_DEVNET_AAPL_MINT?: string;
  readonly VITE_DEVNET_MSFT_MINT?: string;
  readonly VITE_DEVNET_GOOG_MINT?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
