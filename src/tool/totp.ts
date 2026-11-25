import { base32Decode, counterAt, counterToBytes, dynamicTruncate, formatCode } from './types';
import type { TotpAlgorithm } from './types';

const ALGO_NAME: Record<TotpAlgorithm, string> = {
  'SHA-1': 'SHA-1',
  'SHA-256': 'SHA-256',
  'SHA-512': 'SHA-512',
};

async function importKey(algorithm: TotpAlgorithm, keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    keyBytes.slice().buffer as ArrayBuffer,
    { name: 'HMAC', hash: ALGO_NAME[algorithm] },
    false,
    ['sign']
  );
}

async function computeHmac(
  algorithm: TotpAlgorithm,
  keyBytes: Uint8Array,
  message: Uint8Array
): Promise<Uint8Array> {
  const key = await importKey(algorithm, keyBytes);
  const signature = await crypto.subtle.sign('HMAC', key, message.slice().buffer as ArrayBuffer);
  return new Uint8Array(signature);
}

export interface TotpInput {
  secret: string;
  digits: number;
  period: number;
  algorithm: TotpAlgorithm;
  startTime: number;
  /** Unix timestamp the code is generated for (defaults to now). */
  timestamp: number;
}

/** Generate the integer TOTP code (before padding) for the given input. */
export async function generateCode(input: TotpInput): Promise<string> {
  const keyBytes = base32Decode(input.secret);
  const counter = counterAt(input.timestamp, input.period, input.startTime);
  const hmac = await computeHmac(input.algorithm, keyBytes, counterToBytes(counter));
  const code = dynamicTruncate(hmac);
  return formatCode(code, input.digits);
}

/** Full TOTP computation with defaults resolved for the current clock. */
export async function currentTotpCode(input: TotpInput): Promise<string> {
  return generateCode(input);
}
