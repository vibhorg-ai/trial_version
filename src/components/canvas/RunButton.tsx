'use client';

import { useState } from 'react';
import { ChevronDown, Play } from 'lucide-react';
import { useWorkflowStore } from '../../lib/store/workflowStore';

export function RunButton() {
  const [menuOpen, setMenuOpen] = useState(false);
  const startRun = useWorkflowStore((s) => s.startRun);
  const runStatus = useWorkflowStore((s) => s.runStatus);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const isBusy = runStatus === 'starting' || runStatus === 'running';

  const canRunSingle = selectedNodeId !== null && !isBusy;
  const canRunFull = !isBusy;

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => canRunFull && void startRun({ scope: 'FULL', selectedNodeIds: [] })}
        disabled={!canRunFull}
        className="inline-flex items-center gap-2 rounded-l-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={isBusy ? 'Running' : 'Run workflow'}
      >
        <Play className="h-4 w-4" aria-hidden />
        {isBusy ? 'Running…' : 'Run'}
      </button>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        disabled={isBusy}
        aria-label="Run options"
        aria-expanded={menuOpen}
        className="inline-flex items-center rounded-r-lg border-l border-violet-700 bg-violet-600 px-2 py-2 text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronDown className="h-4 w-4" aria-hidden />
      </button>
      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-zinc-200 bg-white py-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            disabled={!canRunSingle}
            className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              setMenuOpen(false);
              if (canRunSingle && selectedNodeId) {
                void startRun({ scope: 'SINGLE', selectedNodeIds: [selectedNodeId] });
              }
            }}
          >
            Run Single Node
            {!canRunSingle ? (
              <span className="ml-2 text-xs text-zinc-400">(select a node)</span>
            ) : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}
