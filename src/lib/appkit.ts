import { createAppKit } from '@reown/appkit/react';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import { solanaDevnet, solanaTestnet } from '@reown/appkit/networks';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID?.trim();

export const REOWN_CONFIGURED = Boolean(projectId);

export const appKit = REOWN_CONFIGURED
  ? createAppKit({
      adapters: [new SolanaAdapter()],
      networks: [solanaDevnet, solanaTestnet],
      defaultNetwork: solanaDevnet,
      projectId: projectId!,
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
    })
  : null;
