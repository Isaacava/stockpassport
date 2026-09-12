import type { DevnetQuote, TradeSide, WalletSigner } from './execution';

export type ExecutionNetwork = 'devnet' | 'mainnet-beta';

export type QuoteRequest = {
  network: ExecutionNetwork;
  assetId: string;
  side: TradeSide;
  amount: string;
};

export type ExecutionResult = {
  paymentSignature: string;
  settlementSignature: string;
  reused?: boolean;
};

export interface ExecutionAdapter {
  getQuote(request: QuoteRequest): Promise<DevnetQuote>;
  execute(quote: DevnetQuote, signer: WalletSigner): Promise<ExecutionResult>;
}

export function createExecutionAdapter(network: ExecutionNetwork): ExecutionAdapter {
  if (network === 'devnet') {
    return {
      async getQuote(request) {
        const { getDevnetQuote } = await import('./execution');
        return getDevnetQuote(request.assetId, request.side, Number(request.amount));
      },
      async execute(quote, signer) {
        const { executeDevnetTrade } = await import('./execution');
        return executeDevnetTrade(quote, signer);
      },
    };
  }

  return {
    async getQuote() {
      throw new Error('Mainnet execution adapter is not configured yet. No production trade is simulated.');
    },
    async execute() {
      throw new Error('Mainnet execution adapter is not configured yet. No production trade is simulated.');
    },
  };
}
