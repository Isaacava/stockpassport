import { Connection, Keypair, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { getParsedAccountInfo } from '@solana/spl-token';

const RPC_URL = process.env.DEVNET_RPC_URL || clusterApiUrl('devnet');
const MARKET_WALLET = process.env.DEVNET_MARKET_WALLET;
const MARKET_KEYPAIR_JSON = process.env.DEVNET_MARKET_KEYPAIR_JSON;
const MINTS = {
  'DEMO-USDC': process.env.DEVNET_CASH_MINT,
  'NVDAx-DEMO': process.env.DEVNET_NVDA_MINT,
  'AAPLx-DEMO': process.env.DEVNET_AAPL_MINT,
  'MSFTx-DEMO': process.env.DEVNET_MSFT_MINT,
  'GOOGx-DEMO': process.env.DEVNET_GOOG_MINT,
};

if (!MARKET_WALLET || !MARKET_KEYPAIR_JSON) {
  throw new Error('Set DEVNET_MARKET_WALLET and DEVNET_MARKET_KEYPAIR_JSON before running this check.');
}

const market = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(MARKET_KEYPAIR_JSON)));
if (market.publicKey.toBase58() !== MARKET_WALLET) throw new Error('Market public key does not match the configured keypair.');

const connection = new Connection(RPC_URL, 'confirmed');
console.log(`Market wallet: ${market.publicKey.toBase58()}`);
console.log(`RPC: ${RPC_URL}`);
console.log(`SOL: ${(await connection.getBalance(market.publicKey, 'confirmed') / 1e9).toFixed(6)}`);

for (const [symbol, mintValue] of Object.entries(MINTS)) {
  if (!mintValue) {
    console.log(`${symbol}: NOT_CONFIGURED`);
    continue;
  }
  const mint = new PublicKey(mintValue);
  const accounts = await connection.getParsedTokenAccountsByOwner(market.publicKey, { mint }, 'confirmed');
  const total = accounts.value.reduce((sum, entry) => sum + Number(entry.account.data.parsed.info.tokenAmount.uiAmountString || '0'), 0);
  console.log(`${symbol}: ${total}`);
}
