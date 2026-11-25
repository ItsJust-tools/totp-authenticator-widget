'use client';

import React from 'react';
import { validateSecret } from '../types';
import type { ToolState } from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

/** Main code display with a live countdown and copy button. */
export default function Canvas({ state, onChange }: CanvasProps) {
  const [countdown, setCountdown] = React.useState<number>(state.period);
  const [now, setNow] = React.useState(() => Math.floor(Date.now() / 1000));
  const [code, setCode] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const validation = React.useMemo(() => validateSecret(state.secret), [state.secret]);

  const effectiveTime = now + state.offset;
  const windowIndex = Math.floor(effectiveTime / state.period);

  React.useEffect(() => {
    const tick = () => {
      const seconds = Math.floor(Date.now() / 1000);
      setNow(seconds);
      setCountdown(() => {
        const elapsed = (seconds + state.offset - state.startTime) % state.period;
        const remaining = state.period - elapsed;
        return remaining === state.period ? 0 : remaining;
      });
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [state.period, state.startTime, state.offset]);

  React.useEffect(() => {
    let cancelled = false;
    if (!validation.valid || !validation.normalizedSecret) {
      // Clear asynchronously so the effect body never sets state synchronously.
      void Promise.resolve().then(() => {
        if (!cancelled) setCode('');
      });
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      try {
        const { generateCode } = await import('../totp');
        const generated = await generateCode({
          secret: validation.normalizedSecret as string,
          digits: state.digits,
          period: state.period,
          algorithm: state.algorithm,
          startTime: state.startTime,
          timestamp: windowIndex * state.period + state.startTime,
        });
        if (!cancelled) setCode(generated);
      } catch {
        if (!cancelled) setCode('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    validation.valid,
    validation.normalizedSecret,
    state.digits,
    state.period,
    state.algorithm,
    state.startTime,
    windowIndex,
  ]);

  const handleCopy = React.useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [code]);

  const progress = countdown / state.period;
  const circumference = 2 * Math.PI * 42;
  const strengthBits = validation.entropyBits;
  const strengthLabel = !validation.valid
    ? 'Invalid'
    : strengthBits >= 100
      ? 'Strong'
      : strengthBits >= 70
        ? 'Good'
        : 'Weak';

  return (
    <div className="flex flex-col items-center gap-6 p-6" data-testid="totp-canvas">
      <div className="relative" aria-live="polite">
        <svg width="120" height="120" viewBox="0 0 120 120" className="rotate-[-90deg]">
          <circle
            cx="60"
            cy="60"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-gray-200 dark:text-gray-700"
          />
          <circle
            cx="60"
            cy="60"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            data-testid="countdown-ring"
            className="text-blue-600 transition-colors"
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-2xl font-semibold tabular-nums"
          data-testid="countdown-seconds"
        >
          {countdown}s
        </span>
      </div>

      <div className="text-center">
        <p className="font-mono text-4xl font-bold tracking-[0.3em]" data-testid="totp-code">
          {code || '------'}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!code}
          data-testid="copy-code"
          className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {copied ? 'Copied!' : 'Copy code'}
        </button>
      </div>

      <div className="w-full max-w-md space-y-3">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Secret (base32)
          <input
            type="text"
            value={state.secret}
            onChange={(e) => onChange?.({ ...state, secret: e.target.value })}
            data-testid="secret-input"
            className={inputClass}
            spellCheck={false}
          />
        </label>
        {validation.error ? (
          <p className="text-xs text-red-600 dark:text-red-400" data-testid="secret-error">
            {validation.error}
          </p>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="secret-strength">
            Format valid — strength: {strengthLabel} (~{strengthBits} bits)
          </p>
        )}
      </div>
    </div>
  );
}
