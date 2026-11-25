/** Interval in seconds between generated codes. */
export type TotpPeriod = 30 | 60;

/** Hash algorithms supported by RFC 6238 and Web Crypto. */
export type TotpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

export interface ToolState {
  /** Base32-encoded secret key, upper case, spaces allowed. */
  secret: string;
  /** Number of digits in the generated code (6-8). */
  digits: 6 | 7 | 8;
  /** Interval in seconds between generated codes. */
  period: TotpPeriod;
  /** Hash algorithm used for HMAC. */
  algorithm: TotpAlgorithm;
  /** Start time (T0) in Unix seconds for counter computation. */
  startTime: number;
  /** Manual clock offset in seconds to correct for clock drift. */
  offset: number;
}

export const DEFAULT_STATE: ToolState = {
  secret: 'JBSWY3DPEHPK3PXP',
  digits: 6,
  period: 30,
  algorithm: 'SHA-1',
  startTime: 0,
  offset: 0,
};

export const MIN_DIGITS = 6;
export const MAX_DIGITS = 8;
export const MIN_SECRET_LENGTH = 8;

/**
 * Result of validating a base32 secret.
 * `normalizedSecret` is undefined when validation failed.
 */
export interface SecretValidation {
  valid: boolean;
  error: string | null;
  normalizedSecret: string | null;
  entropyBits: number;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Normalized entropy estimate for an un-padded base32 secret (0 when empty). */
export function estimateEntropyBits(normalized: string): number {
  return normalized.length * 5;
}

/** Validate and normalize a user-supplied secret (RFC 4648 base32, padding optional). */
export function validateSecret(raw: string): SecretValidation {
  const cleaned = raw.replace(/[\s-]/g, '').toUpperCase();
  if (!cleaned) {
    return { valid: false, error: 'Secret is required.', normalizedSecret: null, entropyBits: 0 };
  }
  if (cleaned.length < MIN_SECRET_LENGTH) {
    return {
      valid: false,
      error: `Secret must be at least ${MIN_SECRET_LENGTH} base32 characters.`,
      normalizedSecret: null,
      entropyBits: cleaned.length * 5,
    };
  }
  const invalid = [...cleaned].filter((c) => !BASE32_ALPHABET.includes(c));
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Invalid base32 characters: ${[...new Set(invalid)].join(', ')}.`,
      normalizedSecret: null,
      entropyBits: 0,
    };
  }
  const unpadded = cleaned.replace(/=+$/, '');
  if (cleaned !== unpadded && cleaned.length % 8 !== 0) {
    return {
      valid: false,
      error: 'Invalid base32 padding.',
      normalizedSecret: null,
      entropyBits: 0,
    };
  }
  return {
    valid: true,
    error: null,
    normalizedSecret: unpadded,
    entropyBits: estimateEntropyBits(unpadded),
  };
}

/** Decode base32 (RFC 4648, A-Z and 2-7) into raw bytes. */
export function base32Decode(normalized: string): Uint8Array {
  const clean = normalized.replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** Encode bytes into base32 (RFC 4648) without padding. */
export function base32Encode(bytes: Uint8Array): string {
  let output = '';
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** TOTP counter (per RFC 6238) for a Unix timestamp in seconds. */
export function counterAt(unixSeconds: number, period: number, startTime: number): number {
  return Math.floor((unixSeconds - startTime) / period);
}

/** Format the counter as the RFC 4226 8-byte big-endian message. */
export function counterToBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8);
  // Use BigInt to stay safe for counters beyond 2^31 (needed after ~2038 for 30s steps).
  const big = BigInt(counter) & 0xffffffffffffffffn;
  for (let i = 7; i >= 0; i--) {
    bytes[i] = Number((big >> BigInt(8 * (7 - i))) & 0xffn);
  }
  return bytes;
}

/** Apply RFC 4226 dynamic truncation to an HMAC result. */
export function dynamicTruncate(hmac: Uint8Array): number {
  const last = hmac[hmac.length - 1] ?? 0;
  const offset = last & 0x0f;
  const at = (i: number): number => hmac[i] ?? 0;
  const binary =
    ((at(offset) & 0x7f) << 24) |
    ((at(offset + 1) & 0xff) << 16) |
    ((at(offset + 2) & 0xff) << 8) |
    (at(offset + 3) & 0xff);
  return binary;
}

/** Integer code padded to the requested digit count. */
export function formatCode(code: number, digits: number): string {
  const mod = 10 ** digits;
  return String(code % mod).padStart(digits, '0');
}

/** Seconds remaining in the current window for a wall clock time. */
export function secondsRemaining(unixSeconds: number, period: number, startTime: number): number {
  const elapsed = (unixSeconds - startTime) % period;
  return period - (elapsed <= 0 && elapsed !== -0 ? elapsed + period : elapsed);
}
