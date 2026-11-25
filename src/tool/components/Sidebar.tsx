'use client';

import React from 'react';
import { base32Encode } from '../types';
import type { ToolState } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
}

/** Sidebar with start-time and offset controls plus a random secret generator. */
export default function Sidebar({ state, onChange }: SidebarProps) {
  const set = React.useCallback(
    (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch }),
    [onChange, state]
  );

  const generateSecret = React.useCallback(() => {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    set({ secret: base32Encode(bytes) });
  }, [set]);

  return (
    <aside className="space-y-4 p-4" data-testid="totp-sidebar">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Clock drift
        </h3>
        <label className="mt-1 block text-xs text-gray-700 dark:text-gray-300">
          Start time (T0, Unix seconds)
          <input
            type="number"
            value={state.startTime}
            onChange={(e) => set({ startTime: Number(e.target.value) || 0 })}
            data-testid="start-time-input"
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
          />
        </label>
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          Normally 0. Adjust only for non-standard T0 setups.
        </p>
      </section>

      <section>
        <button
          type="button"
          onClick={generateSecret}
          data-testid="generate-secret"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Generate random secret
        </button>
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          Uses crypto.getRandomValues locally; nothing leaves your browser.
        </p>
      </section>
    </aside>
  );
}
