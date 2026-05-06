'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ExpandedRunDetail } from './ExpandedRunDetail';
import type { RunSummary } from './HistoryPanel';

const STATUS_COLOR: Record<RunSummary['status'], string> = {
  PENDING: 'bg-zinc-100 text-zinc-700',
  RUNNING: 'bg-blue-100 text-blue-700',
  SUCCESS: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-zinc-100 text-zinc-500',
};

export function RunListItem({ run }: { run: RunSummary }) {
  const [expanded, setExpanded] = useState(false);

  const startedAt = new Date(run.startedAt);
  const durationMs =
    run.finishedAt !== null ? new Date(run.finishedAt).getTime() - startedAt.getTime() : null;

  return (
    <li className="rounded-lg border border-zinc-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50"
        aria-expanded={expanded}
        aria-controls={`run-detail-${run.id}`}
      >
        {expanded ? (
          <ChevronDown aria-hidden className="h-3.5 w-3.5 text-zinc-400" />
        ) : (
          <ChevronRight aria-hidden className="h-3.5 w-3.5 text-zinc-400" />
        )}
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLOR[run.status]}`}>
          {run.status}
        </span>
        <span className="text-xs text-zinc-500">{run.scope}</span>
        <span className="ml-auto text-xs text-zinc-400">
          {startedAt.toLocaleTimeString()}
          {durationMs !== null ? ` · ${(durationMs / 1000).toFixed(1)}s` : ''}
        </span>
      </button>
      {expanded ? <ExpandedRunDetail runId={run.id} /> : null}
    </li>
  );
}
