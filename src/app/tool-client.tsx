'use client';

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { ToolShell, useTool } from '@itsjust/core';
import { decompressFromEncodedURIComponent } from 'lz-string';
import { toolConfig, templateBaseVersion, Canvas, Toolbar, Sidebar } from '@/tool';
import { totpTool } from '@/tool/tool-definition';
import { validateSecret, type ToolState } from '@/tool';

function summaryText(state: ToolState): string {
  const validation = validateSecret(state.secret);
  const label = validation.valid ? 'valid' : 'invalid secret';
  return `${state.digits} digits · ${state.period}s · ${state.algorithm} · ${label}`;
}

export default function ToolClient() {
  const ToolShellCompat = ToolShell as unknown as ComponentType<Record<string, unknown>> & {
    Toolbar?: ComponentType<{ children?: ReactNode }>;
    Body?: ComponentType<{ children?: ReactNode }>;
    Sidebar?: ComponentType<{ children?: ReactNode }>;
    Canvas?: ComponentType<{ children?: ReactNode }>;
    StatusBar?: ComponentType<{ children?: ReactNode }>;
  };
  const canvasRef = useRef<HTMLDivElement>(null);
  const tool = useTool<ToolState>(totpTool, canvasRef);
  const setToolData = tool.state.setData;
  const showToast = tool.toast;
  const hasLoadedSharedState = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth > 768 && toolConfig.features.sidebar
  );

  const state = tool.state.data;

  useEffect(() => {
    if (hasLoadedSharedState.current) return;
    hasLoadedSharedState.current = true;
    const params = new URLSearchParams(window.location.search);
    const encodedState = params.get('state');
    if (!encodedState) return;
    try {
      const serialized = decompressFromEncodedURIComponent(encodedState);
      if (!serialized) throw new Error('Invalid shared URL');
      const parsed: unknown = JSON.parse(serialized);
      const deserialized = totpTool.deserialize(parsed);
      if (!deserialized.success) throw new Error(deserialized.error);
      setToolData(deserialized.data);
      showToast('Loaded state from shared URL', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load shared URL';
      showToast(message, 'error');
    }
  }, [setToolData, showToast]);

  const toolbarContent = (
    <Toolbar state={state} onChange={(next: ToolState) => setToolData(() => next)} />
  );

  const sidebarContent = (
    <Sidebar state={state} onChange={(next: ToolState) => setToolData(() => next)} />
  );

  const canvasContent = (
    <div ref={canvasRef}>
      <Canvas state={state} onChange={(next: ToolState) => setToolData(() => next)} />
    </div>
  );

  const statusBarContent = (
    <>
      <span
        className={`status-slot status-slot-state ${tool.state.isDirty ? 'status-unsaved' : 'status-saved'}`}
      >
        {tool.state.isDirty ? (
          <>
            <span className="status-saving-dot" />
            Unsaved
          </>
        ) : tool.state.lastSaved ? (
          <>Saved {tool.state.lastSaved}</>
        ) : (
          'Ready'
        )}
      </span>
      <span className="status-slot status-slot-mode">{state.algorithm}</span>
      <span className="status-slot status-slot-summary">{summaryText(state)}</span>
      <span className="status-slot status-slot-tool-version">Tool v{toolConfig.version}</span>
      <span className="status-slot status-slot-template-version">
        Template v{templateBaseVersion}
      </span>
    </>
  );

  const hasLegacySections = Boolean(
    ToolShellCompat.Toolbar &&
    ToolShellCompat.Body &&
    ToolShellCompat.Sidebar &&
    ToolShellCompat.Canvas &&
    ToolShellCompat.StatusBar
  );

  return (
    <ToolShellCompat
      config={toolConfig}
      sidebarOpen={sidebarOpen}
      onSidebarChange={setSidebarOpen}
      toolbar={toolbarContent}
      sidebar={sidebarContent}
      canvas={canvasContent}
      statusBar={statusBarContent}
    >
      {hasLegacySections
        ? (() => {
            const ToolbarSection = ToolShellCompat.Toolbar as ComponentType<{
              children?: ReactNode;
            }>;
            const BodySection = ToolShellCompat.Body as ComponentType<{ children?: ReactNode }>;
            const SidebarSection = ToolShellCompat.Sidebar as ComponentType<{
              children?: ReactNode;
            }>;
            const CanvasSection = ToolShellCompat.Canvas as ComponentType<{
              children?: ReactNode;
            }>;
            const StatusBarSection = ToolShellCompat.StatusBar as ComponentType<{
              children?: ReactNode;
            }>;
            return (
              <>
                <ToolbarSection>{toolbarContent}</ToolbarSection>
                <BodySection>
                  <SidebarSection>{sidebarContent}</SidebarSection>
                  <CanvasSection>{canvasContent}</CanvasSection>
                </BodySection>
                <StatusBarSection>{statusBarContent}</StatusBarSection>
              </>
            );
          })()
        : null}
    </ToolShellCompat>
  );
}
