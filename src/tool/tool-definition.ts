import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  DEFAULT_STATE,
  MAX_DIGITS,
  MIN_DIGITS,
  type ToolState,
  type TotpAlgorithm,
  type TotpPeriod,
} from './types';

const VALID_PERIODS: TotpPeriod[] = [30, 60];
const VALID_ALGORITHMS: TotpAlgorithm[] = ['SHA-1', 'SHA-256', 'SHA-512'];
const VALID_DIGITS: Array<ToolState['digits']> = [6, 7, 8];

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    secret: state.secret,
    digits: state.digits,
    period: state.period,
    algorithm: state.algorithm,
    startTime: state.startTime,
    offset: state.offset,
  });
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function oneOf<T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { success: false, error: 'Invalid data format: expected TOTP tool state object' };
  }
  const v = data as Record<string, unknown>;
  const startTimeRaw = numberOr(v.startTime, DEFAULT_STATE.startTime);
  const offsetRaw = numberOr(v.offset, DEFAULT_STATE.offset);
  const digitsRaw = oneOf(v.digits, VALID_DIGITS, DEFAULT_STATE.digits);
  const digits = Math.min(MAX_DIGITS, Math.max(MIN_DIGITS, digitsRaw)) as ToolState['digits'];
  const state: ToolState = {
    secret: stringOr(v.secret, DEFAULT_STATE.secret),
    digits,
    period: oneOf(v.period, VALID_PERIODS, DEFAULT_STATE.period),
    algorithm: oneOf(v.algorithm, VALID_ALGORITHMS, DEFAULT_STATE.algorithm),
    startTime: startTimeRaw,
    offset: offsetRaw,
  };
  return { success: true, data: state };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

export const totpTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig as unknown as Tool<ToolState>['config'],
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
};
