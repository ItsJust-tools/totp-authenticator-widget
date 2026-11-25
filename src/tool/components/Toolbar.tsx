'use client';

import type { ToolState } from '../types';

interface ToolbarProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onClear?: () => void;
  onCopy?: () => void;
}

const optionButton =
  'rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800';

/** Top toolbar: digits, period, algorithm and clock-offset controls. */
export default function Toolbar({ state, onChange }: ToolbarProps) {
  const set = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="totp-toolbar">
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">Digits</span>
        {([6, 7, 8] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => set({ digits: d })}
            data-testid={`digits-${d}`}
            aria-pressed={state.digits === d}
            className={`${optionButton} ${
              state.digits === d
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                : 'border-gray-300 dark:border-gray-700'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">Period</span>
        {([30, 60] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => set({ period: p })}
            data-testid={`period-${p}`}
            aria-pressed={state.period === p}
            className={`${optionButton} ${
              state.period === p
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                : 'border-gray-300 dark:border-gray-700'
            }`}
          >
            {p}s
          </button>
        ))}
      </div>

      <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        Algorithm
        <select
          value={state.algorithm}
          onChange={(e) => set({ algorithm: e.target.value as ToolState['algorithm'] })}
          data-testid="algorithm-select"
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="SHA-1">SHA-1</option>
          <option value="SHA-256">SHA-256</option>
          <option value="SHA-512">SHA-512</option>
        </select>
      </label>

      <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        Offset (s)
        <input
          type="number"
          value={state.offset}
          onChange={(e) => set({ offset: Number(e.target.value) || 0 })}
          data-testid="offset-input"
          className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
        />
      </label>
    </div>
  );
}
