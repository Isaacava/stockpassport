import { createAppKit } from '@reown/appkit/react';
import { SolanaAdapter } from '@reown/appkit-adapter-solana/react';
import { solanaDevnet, solanaTestnet } from '@reown/appkit/networks';

const configuredProjectId = import.meta.env.VITE_REOWN_PROJECT_ID?.trim();

// Reown project IDs are public client configuration. Keep a safe project fallback
// so one missing Vercel environment variable cannot leave the React tree blank.
const projectId = configuredProjectId || '1dbe8fd5e4974ae7c80d074c4082b5a0';

export const REOWN_CONFIGURED = Boolean(projectId);

export const appKit = createAppKit({
  adapters: [new SolanaAdapter()],
  networks: [solanaDevnet, solanaTestnet],
  defaultNetwork: solanaDevnet,
  projectId,
  metadata: {
    name: 'StockPassport',
    description: 'StockPassport Solana portfolio demo',
    url: window.location.origin,
    icons: [`${window.location.origin}/favicon.svg`],
  },
  features: {
    analytics: false,
  },
  themeMode: 'light',
  themeVariables: {
    '--apkt-accent': '#2459ff',
    '--apkt-color-mix': '#2459ff',
    '--apkt-color-mix-strength': 18,
    '--apkt-border-radius-master': '14px',
  },
});
