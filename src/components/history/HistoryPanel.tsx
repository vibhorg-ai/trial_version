'use client';

import { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';
import { useWorkflowStore } from '../../lib/store/workflowStore';
import { RunListItem } from './RunListItem';
import { HistoryListSkeleton } from '../ui/skeletons/HistoryListSkeleton';

export interface RunSummary {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'CANCELLED';
  scope: 'FULL' | 'PARTIAL' | 'SINGLE';
  startedAt: string;
  finishedAt: string | null;
  selectedNodeIds: string[];
}

export interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  workflowId: string;
}

export function HistoryPanel({ open, onClose, workflowId }: HistoryPanelProps) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runStatus = useWorkflowStore((s) => s.runStatus);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/workflows/${workflowId}/runs`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { runs: RunSummary[] };
        if (!cancelled) setRuns(data.runs);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, workflowId, runStatus]);

  if (!open) return null;

  return (
    <aside
      role="complementary"
      aria-label="Run history"
      className="fixed right-0 top-0 z-30 flex h-full w-96 flex-col border-l border-zinc-200 bg-white shadow-xl"
    >
      <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <History aria-hidden className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-900">Run History</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close history panel"
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </header>
      <div className="flex-1 overflow-auto px-3 py-3">
        {loading && runs.length === 0 ? (
          <div className="px-2 py-4">
            <HistoryListSkeleton />
          </div>
        ) : error ? (
          <p role="alert" className="px-2 py-4 text-sm text-red-600">
            {error}
          </p>
        ) : runs.length === 0 ? (
          <p className="px-2 py-4 text-sm text-zinc-500">
            No runs yet — click <strong>Run</strong> to start one.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {runs.map((run) => (
              <RunListItem key={run.id} run={run} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
