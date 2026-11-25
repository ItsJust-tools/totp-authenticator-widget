import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import ToolClient from '@/app/tool-client';
import ToolClientWrapper from '@/app/tool-client-wrapper';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="dynamic-tool-client">dynamic-tool-client</div>,
}));

const mockSetData = vi.fn();
const mockToast = vi.fn();

vi.mock('@itsjust/core', () => ({
  ToolShell: ({ toolbar, sidebar, canvas, statusBar }: Record<string, unknown>) => (
    <div>
      <div>{toolbar as ReactNode}</div>
      <div>{sidebar as ReactNode}</div>
      <div>{canvas as ReactNode}</div>
      <div>{statusBar as ReactNode}</div>
    </div>
  ),
  useTool: () => ({
    state: {
      data: {
        secret: 'JBSWY3DPEHPK3PXP',
        digits: 6,
        period: 30,
        algorithm: 'SHA-1',
        startTime: 0,
        offset: 0,
      },
      setData: mockSetData,
      isDirty: false,
      lastSaved: 'just now',
    },
    toast: mockToast,
  }),
}));

vi.mock('@/tool', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/tool')>();
  return { ...actual, templateBaseVersion: '1.4.0' };
});

describe('tool client', () => {
  beforeEach(() => {
    mockSetData.mockReset();
    mockToast.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    window.history.replaceState(null, '', 'http://localhost:3000/');
  });

  it('renders dynamic tool client wrapper', () => {
    render(<ToolClientWrapper />);
    expect(screen.getByTestId('dynamic-tool-client')).toBeInTheDocument();
  });

  it('renders canvas, toolbar and status from live tool client', () => {
    render(<ToolClient />);
    expect(screen.getByTestId('totp-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('totp-toolbar')).toBeInTheDocument();
  });

  it('copies the current code to clipboard', async () => {
    const clipboardSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: { writeText: clipboardSpy },
    });
    render(<ToolClient />);
    const codeElement = screen.getByTestId('totp-code');
    await waitFor(() => expect(codeElement.textContent).toMatch(/^\d{6}$/));
    fireEvent.click(screen.getByTestId('copy-code'));
    await waitFor(() =>
      expect(clipboardSpy).toHaveBeenCalledWith(expect.stringMatching(/^\d{6}$/))
    );
    await waitFor(() => expect(screen.getByTestId('copy-code').textContent).toBe('Copied!'));
  });

  it('loads shared URL state', async () => {
    const { deserializeState } = await import('@/tool/tool-definition');
    const { compressToEncodedURIComponent } = await import('lz-string');
    const goodState = compressToEncodedURIComponent(
      JSON.stringify({
        secret: 'JBSWY3DPEHPK3PXP',
        digits: 6,
        period: 30,
        algorithm: 'SHA-1',
        startTime: 0,
        offset: 0,
      })
    );
    window.history.replaceState(
      null,
      '',
      `http://localhost:3000/?state=${encodeURIComponent(goodState)}`
    );
    render(<ToolClient />);
    await waitFor(() => expect(mockSetData).toHaveBeenCalled());
    const repaired = deserializeState({ nope: 1 });
    expect(repaired.success).toBe(true);
  });
});
