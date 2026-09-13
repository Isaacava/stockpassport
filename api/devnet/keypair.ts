import { Keypair } from '@solana/web3.js';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const INDEX = new Map(ALPHABET.split('').map((char, index) => [char, index]));

function decodeBase58(value: string): Uint8Array {
  const text = value.trim();
  if (!text) throw new Error('Empty base58 private key');

  let bytes = [0];
  for (const char of text) {
    const digit = INDEX.get(char);
    if (digit === undefined) throw new Error('Invalid base58 private key');

    let carry = digit;
    for (let i = 0; i < bytes.length; i += 1) {
      const next = bytes[i] * 58 + carry;
      bytes[i] = next & 0xff;
      carry = next >> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  let leadingZeros = 0;
  while (leadingZeros < text.length && text[leadingZeros] === '1') leadingZeros += 1;
  const decoded = new Uint8Array(leadingZeros + bytes.length);
  for (let i = 0; i < bytes.length; i += 1) decoded[decoded.length - 1 - i] = bytes[i];
  return decoded;
}

export function loadMarketKeypair(): Keypair {
  const base58 = process.env.DEVNET_MARKET_PRIVATE_KEY;
  if (base58) return Keypair.fromSecretKey(decodeBase58(base58));

  const json = process.env.DEVNET_MARKET_KEYPAIR_JSON;
  if (json) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(json) as number[]));

  throw new Error('DEVNET_MARKET_PRIVATE_KEY or DEVNET_MARKET_KEYPAIR_JSON is not configured');
}
