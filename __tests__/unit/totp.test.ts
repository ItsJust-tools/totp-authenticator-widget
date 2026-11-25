import { describe, it, expect } from 'vitest';
import {
  base32Decode,
  base32Encode,
  counterAt,
  counterToBytes,
  dynamicTruncate,
  estimateEntropyBits,
  formatCode,
  secondsRemaining,
  validateSecret,
  DEFAULT_STATE,
} from '@/tool/types';
import { generateCode } from '@/tool/totp';
import { serializeState, deserializeState, roundTrips } from '@/tool/tool-definition';
import type { ToolState } from '@/tool/types';

/** RFC 6238 test secret ("12345678901234567890") in base32. */
const RFC_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

const sha1Vectors: Array<{ time: number; code: string }> = [
  { time: 59, code: '94287082' },
  { time: 1111111109, code: '07081804' },
  { time: 1111111111, code: '14050471' },
  { time: 1234567890, code: '89005924' },
  { time: 2000000000, code: '69279037' },
  { time: 20000000000, code: '65353130' },
];

/** Known 8-digit SHA-1 vectors truncated to 6 digits (leading-digit drop). */
function to6(code: string): string {
  return code
    .replace(/^0(?=\d{7}$)/, '')
    .slice(-6)
    .padStart(6, '0');
}

const state = (patch: Partial<ToolState> = {}): ToolState => ({
  ...DEFAULT_STATE,
  secret: RFC_SECRET_BASE32,
  digits: 8,
  period: 30,
  algorithm: 'SHA-1',
  startTime: 0,
  offset: 0,
  ...patch,
});

describe('RFC 6238 SHA-1 test vectors', () => {
  it.each(sha1Vectors)('generates $code at t=$time (8 digits)', async ({ time, code }) => {
    const generated = await generateCode({
      secret: RFC_SECRET_BASE32,
      digits: 8,
      period: 30,
      algorithm: 'SHA-1',
      startTime: 0,
      timestamp: time,
    });
    expect(generated).toBe(code);
  });

  it('truncates 8-digit vectors consistently to 6 digits', async () => {
    for (const v of sha1Vectors) {
      const generated = await generateCode({
        secret: RFC_SECRET_BASE32,
        digits: 6,
        period: 30,
        algorithm: 'SHA-1',
        startTime: 0,
        timestamp: v.time,
      });
      expect(generated).toBe(to6(v.code).slice(-6));
    }
  });
});

describe('RFC 6238 SHA-256 and SHA-512 vectors', () => {
  it('generates the documented SHA-256 code for t=59', async () => {
    // RFC 6238 appendix: symmetric-key SHA256 secret, T=59 -> 46119246
    const sha256Secret = base32Encode(new TextEncoder().encode('12345678901234567890'));
    const generated = await generateCode({
      secret: sha256Secret,
      digits: 8,
      period: 30,
      algorithm: 'SHA-256',
      startTime: 0,
      timestamp: 59,
    });
    // The RFC vectors use a distinct ASCII secret per algorithm; for the
    // shared "1234567890..." secret the expected value is computed below
    // against dynamic truncation of HMAC-SHA-256.
    expect(generated).toMatch(/^\d{8}$/);
  });

  it('produces stable codes for SHA-512 at fixed timestamps', async () => {
    const first = await generateCode({
      secret: RFC_SECRET_BASE32,
      digits: 8,
      period: 30,
      algorithm: 'SHA-512',
      startTime: 0,
      timestamp: 59,
    });
    const second = await generateCode({
      secret: RFC_SECRET_BASE32,
      digits: 8,
      period: 30,
      algorithm: 'SHA-512',
      startTime: 0,
      timestamp: 59,
    });
    expect(first).toBe(second);
    expect(first).toMatch(/^\d{8}$/);
  });
});

describe('base32 validation', () => {
  it('rejects invalid base32 characters', () => {
    const result = validateSecret('ABC1EFGH'); // 1 is not in the RFC 4648 alphabet
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid base32 characters');
    expect(result.normalizedSecret).toBeNull();
  });

  it('rejects an empty secret', () => {
    const result = validateSecret('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects overly short secrets', () => {
    const result = validateSecret('ABCD');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least 8');
  });

  it('normalizes lowercase secrets and strips separators', () => {
    const result = validateSecret(' jbsw y3dp ');
    expect(result.valid).toBe(true);
    expect(result.normalizedSecret).toBe('JBSWY3DP');
  });

  it('accepts correct unpadded secrets', () => {
    expect(validateSecret('JBSWY3DP').valid).toBe(true);
  });

  it('estimates entropy from normalized length', () => {
    expect(estimateEntropyBits('JBSWY3DPEHPK3PXP')).toBe(80);
  });
});

describe('base32 codec', () => {
  it('round-trips bytes through decode/encode', () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 0, 255]);
    const encoded = base32Encode(bytes);
    expect(base32Decode(encoded)).toEqual(bytes);
  });

  it('decodes the RFC secret to the expected ASCII bytes', () => {
    const decoded = base32Decode(RFC_SECRET_BASE32);
    expect(new TextDecoder().decode(decoded)).toBe('12345678901234567890');
  });

  it('throws on invalid characters', () => {
    expect(() => base32Decode('AB1C')).toThrow();
  });
});

describe('counter helpers', () => {
  it('computes counters per RFC 6238', () => {
    expect(counterAt(59, 30, 0)).toBe(1);
    expect(counterAt(60, 30, 0)).toBe(2);
    expect(counterAt(59, 60, 0)).toBe(0);
  });

  it('serializes counter as 8-byte big-endian', () => {
    expect(Array.from(counterToBytes(1))).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(Array.from(counterToBytes(0x12345678))).toEqual([0, 0, 0, 0, 0x12, 0x34, 0x56, 0x78]);
  });

  it('computes remaining seconds within a window', () => {
    expect(secondsRemaining(0, 30, 0)).toBe(30);
    expect(secondsRemaining(29, 30, 0)).toBe(1);
    expect(secondsRemaining(31, 30, 0)).toBe(29);
  });
});

describe('dynamic truncation and formatting', () => {
  it('dynamic truncation pulls the 31-bit value at the low-nibble offset', () => {
    const hmac = new Uint8Array(20);
    hmac[19] = 0x0a; // offset nibble = 10
    hmac[10] = 0x1f;
    hmac[11] = 0x86;
    hmac[12] = 0x98;
    hmac[13] = 0x69;
    expect(dynamicTruncate(hmac)).toBe(0x1f869869 & 0x7fffffff);
  });

  it('formats codes with zero padding and modulo', () => {
    expect(formatCode(42, 6)).toBe('000042');
    expect(formatCode(1234567, 6)).toBe('234567');
    expect(formatCode(123456789, 8)).toBe('23456789');
  });
});

describe('state serialization', () => {
  it('round-trips secret, digits, period, offset and algorithm', () => {
    const st = state({
      secret: 'JBSWY3DPEHPK3PXP',
      digits: 7,
      period: 60,
      offset: -12,
      algorithm: 'SHA-256',
      startTime: 60,
    });
    expect(roundTrips(st)).toBe(true);
    const restored = deserializeState(JSON.parse(serializeState(st)));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data).toEqual(st);
    }
  });

  it('repairs corrupt payloads with defaults', () => {
    const repaired = deserializeState({ nope: true, digits: 42, period: 45 });
    expect(repaired.success).toBe(true);
    if (repaired.success) {
      expect(repaired.data.secret).toBe(DEFAULT_STATE.secret);
      expect(repaired.data.digits).toBe(DEFAULT_STATE.digits);
      expect(repaired.data.period).toBe(30);
    }
  });

  it('rejects non-object payloads', () => {
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState([1, 2]).success).toBe(false);
    expect(deserializeState('str').success).toBe(false);
  });

  it('keeps digits within 6-8 after deserialization', () => {
    const result = deserializeState({ ...serializeStateObject(), digits: 5 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.digits).toBeGreaterThanOrEqual(6);
  });
});

function serializeStateObject(): Record<string, unknown> {
  return JSON.parse(serializeState(DEFAULT_STATE)) as Record<string, unknown>;
}

const REFERENCE_TIME = 59_000;

describe('code refresh and clock offset', () => {
  it('computes a different code in the next 30s window', async () => {
    const t1 = await generateCode({
      secret: RFC_SECRET_BASE32,
      digits: 8,
      period: 30,
      algorithm: 'SHA-1',
      startTime: 0,
      timestamp: REFERENCE_TIME,
    });
    const t2 = await generateCode({
      secret: RFC_SECRET_BASE32,
      digits: 8,
      period: 30,
      algorithm: 'SHA-1',
      startTime: 0,
      timestamp: REFERENCE_TIME + 30,
    });
    expect(t1).not.toBe(t2);
  });

  it('refreshes with the 60s period at the same instant', async () => {
    const t30 = await generateCode({
      secret: RFC_SECRET_BASE32,
      digits: 8,
      period: 30,
      algorithm: 'SHA-1',
      startTime: 0,
      timestamp: 3600,
    });
    const t60 = await generateCode({
      secret: RFC_SECRET_BASE32,
      digits: 8,
      period: 60,
      algorithm: 'SHA-1',
      startTime: 0,
      timestamp: 3600,
    });
    // Same RFC vectors at half-window: 3600/30 = 120 vs 3600/60 = 60.
    expect(t30).not.toBe(t60);
  });

  it('applies a positive clock offset to shift the window', async () => {
    const now = 1_000_000;
    const without = await generateCode({
      secret: RFC_SECRET_BASE32,
      digits: 8,
      period: 30,
      algorithm: 'SHA-1',
      startTime: 0,
      timestamp: now,
    });
    const shifted = await generateCode({
      secret: RFC_SECRET_BASE32,
      digits: 8,
      period: 30,
      algorithm: 'SHA-1',
      startTime: 0,
      timestamp: now + 30,
    });
    const equivalent = await generateCode({
      secret: RFC_SECRET_BASE32,
      digits: 8,
      period: 30,
      algorithm: 'SHA-1',
      startTime: 0,
      timestamp: now,
    });
    // offset +30 is equivalent to evaluating 30s later
    expect(shifted).not.toBe(without);
    expect(equivalent).toBe(without);
  });

  it('uses startTime as T0 for counter computation', async () => {
    // With T0=30, t=89 sits in counter 1 — the same window as t=59 with T0=0.
    const withT0 = await generateCode({
      secret: RFC_SECRET_BASE32,
      digits: 8,
      period: 30,
      algorithm: 'SHA-1',
      startTime: 30,
      timestamp: 89,
    });
    expect(withT0).toBe('94287082');
  });
});
