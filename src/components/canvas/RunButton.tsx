'use client';

import { useState } from 'react';
import { ChevronDown, Play } from 'lucide-react';
import { useWorkflowStore } from '../../lib/store/workflowStore';

export type RunButtonProps = {
  /** Galaxy-style canvas header: purple play square + white chevron (run options). */
  variant?: 'split' | 'toolbar';
};

export function RunButton({ variant = 'split' }: RunButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const startRun = useWorkflowStore((s) => s.startRun);
  const runStatus = useWorkflowStore((s) => s.runStatus);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const multiSelectedNodeIds = useWorkflowStore((s) => s.multiSelectedNodeIds);
  const isBusy = runStatus === 'starting' || runStatus === 'running';

  const canRunSingle = selectedNodeId !== null && !isBusy && multiSelectedNodeIds.length <= 1;
  const canRunSelected = multiSelectedNodeIds.length >= 2 && !isBusy;
  const canRunFull = !isBusy;

  const menu = menuOpen ? (
    <div
      role="menu"
      className="absolute right-0 top-full z-20 mt-1 w-60 rounded-lg border border-zinc-200 bg-white py-1 shadow-md dark:border-zinc-600 dark:bg-zinc-900"
    >
      <button
        type="button"
        role="menuitem"
        disabled={!canRunSingle}
        title={!canRunSingle ? 'Select a single node first' : undefined}
        className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
        onClick={() => {
          setMenuOpen(false);
          if (canRunSingle && selectedNodeId) {
            void startRun({ scope: 'SINGLE', selectedNodeIds: [selectedNodeId] });
          }
        }}
      >
        Run Single Node
        {!canRunSingle ? <span className="ml-2 text-xs text-zinc-400">(select one)</span> : null}
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!canRunSelected}
        title={!canRunSelected ? 'Shift-click 2+ nodes to enable Run Selected' : undefined}
        className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
        onClick={() => {
          setMenuOpen(false);
          if (canRunSelected) {
            void startRun({
              scope: 'SELECTED',
              selectedNodeIds: [...multiSelectedNodeIds],
            });
          }
        }}
      >
        Run Selected
        <span className="ml-2 text-xs text-zinc-400">
          {canRunSelected ? `(${multiSelectedNodeIds.length} nodes)` : '(shift-click 2+ nodes)'}
        </span>
      </button>
    </div>
  ) : null;

  if (variant === 'toolbar') {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => canRunFull && void startRun({ scope: 'FULL', selectedNodeIds: [] })}
          disabled={!canRunFull}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={isBusy ? 'Running' : 'Run workflow'}
        >
          <Play className="h-4 w-4" aria-hidden />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={isBusy}
            aria-label="Run options"
            aria-expanded={menuOpen}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
          {menu}
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-flex overflow-hidden rounded-md shadow-sm ring-1 ring-black/5 dark:ring-white/10">
      <button
        type="button"
        onClick={() => canRunFull && void startRun({ scope: 'FULL', selectedNodeIds: [] })}
        disabled={!canRunFull}
        className="inline-flex items-center gap-1.5 rounded-none bg-violet-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={isBusy ? 'Running' : 'Run workflow'}
      >
        <Play className="h-3.5 w-3.5" aria-hidden />
        {isBusy ? 'Running…' : 'Run'}
      </button>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        disabled={isBusy}
        aria-label="Run options"
        aria-expanded={menuOpen}
        className="inline-flex items-center rounded-none border-l border-violet-900/35 bg-violet-600 px-2 py-1.5 text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      {menu}
    </div>
  );
}
