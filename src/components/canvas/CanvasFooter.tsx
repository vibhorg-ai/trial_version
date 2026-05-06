'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BackgroundVariant, useReactFlow, useStore } from 'reactflow';
import { shallow } from 'zustand/shallow';
import {
  ChevronLeft,
  Command,
  LayoutGrid,
  Layers,
  Maximize2,
  Move,
  Redo2,
  Sparkles,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useWorkflowStore } from '../../lib/store/workflowStore';
import { BottomToolbar } from './BottomToolbar';

const divider = (
  <div className="mx-0.5 h-5 w-px shrink-0 bg-gray-200 dark:bg-zinc-600" aria-hidden />
);

function FooterIconButton({
  label,
  title: titleProp,
  pressed,
  disabled,
  onClick,
  square,
  children,
}: {
  label: string;
  title?: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** Squircle like Galaxy map toggle */
  square?: boolean;
  children: ReactNode;
}) {
  const title = titleProp ?? label;
  const shape = square
    ? 'h-9 w-9 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-zinc-600 dark:bg-zinc-900'
    : 'h-8 w-8 rounded-full';
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-zinc-200 dark:hover:bg-zinc-800 ${shape} ${
        pressed && !square ? 'bg-gray-100 dark:bg-zinc-800' : ''
      } ${pressed && square ? 'ring-2 ring-indigo-400 dark:ring-indigo-500' : ''}`}
    >
      {children}
    </button>
  );
}

export type CanvasFooterProps = {
  backgroundVariant: BackgroundVariant;
  onToggleBackground: () => void;
  minimapOpen: boolean;
  onToggleMinimap: () => void;
};

export function CanvasFooter({
  backgroundVariant,
  onToggleBackground,
  minimapOpen,
  onToggleMinimap,
}: CanvasFooterProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [panTool, setPanTool] = useState(false);
  const [fsOpen, setFsOpen] = useState(false);

  useEffect(() => {
    const sync = () => setFsOpen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const zoomPercent = useStore((s) => Math.round(s.transform[2] * 100));
  const { minZoomReached, maxZoomReached } = useStore(
    (s) => ({
      minZoomReached: s.transform[2] <= s.minZoom,
      maxZoomReached: s.transform[2] >= s.maxZoom,
    }),
    shallow,
  );

  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const canUndo = useWorkflowStore((s) => s.past.length > 0);
  const canRedo = useWorkflowStore((s) => s.future.length > 0);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const leftPill = (
    <div
      data-testid="canvas-footer-left"
      className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-gray-200 bg-white px-1.5 py-1 shadow-md dark:border-zinc-600 dark:bg-zinc-900"
    >
      <FooterIconButton
        label="Fit view"
        onClick={() => void fitView({ padding: 0.2, duration: 200 })}
      >
        <ChevronLeft aria-hidden className="h-4 w-4" />
      </FooterIconButton>
      {divider}
      <FooterIconButton label="Undo" disabled={!canUndo} onClick={() => undo()}>
        <Undo2 aria-hidden className="h-4 w-4" />
      </FooterIconButton>
      <FooterIconButton label="Redo" disabled={!canRedo} onClick={() => redo()}>
        <Redo2 aria-hidden className="h-4 w-4" />
      </FooterIconButton>
      {divider}
      <FooterIconButton label="Command palette" disabled title="Command palette (coming soon)">
        <Command aria-hidden className="h-4 w-4" />
      </FooterIconButton>
      {divider}
      <FooterIconButton
        label="Zoom out"
        disabled={minZoomReached}
        onClick={() => zoomOut({ duration: 200 })}
      >
        <ZoomOut aria-hidden className="h-4 w-4" />
      </FooterIconButton>
      <span
        className="min-w-[2.75rem] select-none text-center text-xs font-medium tabular-nums text-gray-600 dark:text-zinc-300"
        aria-live="polite"
        data-testid="canvas-zoom-percent"
      >
        {zoomPercent}%
      </span>
      <FooterIconButton
        label="Zoom in"
        disabled={maxZoomReached}
        onClick={() => zoomIn({ duration: 200 })}
      >
        <ZoomIn aria-hidden className="h-4 w-4" />
      </FooterIconButton>
      {divider}
      <FooterIconButton
        label={fsOpen ? 'Exit full screen' : 'Enter full screen'}
        pressed={fsOpen}
        onClick={() => void toggleFullscreen()}
      >
        <Maximize2 aria-hidden className="h-4 w-4" />
      </FooterIconButton>
      <FooterIconButton
        label="Toggle grid style"
        pressed={backgroundVariant === BackgroundVariant.Lines}
        onClick={onToggleBackground}
      >
        <LayoutGrid aria-hidden className="h-4 w-4" />
      </FooterIconButton>
      <FooterIconButton
        label="Pan tool"
        pressed={panTool}
        onClick={() => setPanTool((p) => !p)}
        title="Pan tool (highlight only; drag the canvas as usual)"
      >
        <Move aria-hidden className="h-4 w-4" />
      </FooterIconButton>
    </div>
  );

  return (
    <div
      data-testid="canvas-footer"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 px-4 pb-4"
    >
      {leftPill}

      <div className="pointer-events-auto flex flex-1 justify-center">
        <BottomToolbar embedded />
      </div>

      <div className="pointer-events-auto flex items-end gap-2">
        <FooterIconButton
          label={minimapOpen ? 'Hide minimap' : 'Show minimap'}
          pressed={minimapOpen}
          square
          onClick={onToggleMinimap}
        >
          <Layers aria-hidden className="h-4 w-4" />
        </FooterIconButton>
        <button
          type="button"
          aria-label="AI assist"
          title="AI assist (coming soon)"
          disabled
          className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-white shadow-md opacity-60 dark:bg-zinc-950"
        >
          <Sparkles aria-hidden className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
