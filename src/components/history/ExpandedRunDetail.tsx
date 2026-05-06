'use client';

import { useEffect, useState } from 'react';

interface NodeRun {
  id: string;
  nodeId: string;
  nodeType: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  startedAt: string | null;
  finishedAt: string | null;
  inputs: unknown;
  output: unknown;
  errorMessage: string | null;
}

const NODE_STATUS_COLOR: Record<NodeRun['status'], string> = {
  PENDING: 'text-zinc-500',
  RUNNING: 'text-blue-600',
  SUCCESS: 'text-emerald-600',
  FAILED: 'text-red-600',
  SKIPPED: 'text-zinc-400',
};

export function ExpandedRunDetail({ runId }: { runId: string }) {
  const [nodes, setNodes] = useState<NodeRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/runs/${runId}/nodes`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { nodes: NodeRun[] }) => {
        if (!cancelled) setNodes(data.nodes);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (loading) return <p className="px-3 py-2 text-xs text-zinc-500">Loading nodes…</p>;
  if (error)
    return (
      <p role="alert" className="px-3 py-2 text-xs text-red-600">
        {error}
      </p>
    );
  if (nodes.length === 0) return <p className="px-3 py-2 text-xs text-zinc-500">No node runs.</p>;

  return (
    <div id={`run-detail-${runId}`} className="border-t border-zinc-100 px-3 py-2">
      <ul className="flex flex-col gap-1">
        {nodes.map((n) => (
          <li key={n.id} className="rounded border border-zinc-100 px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${NODE_STATUS_COLOR[n.status]}`}>
                {n.status}
              </span>
              <span className="font-mono text-xs text-zinc-700">{n.nodeType}</span>
              <span className="ml-auto text-xs text-zinc-400">
                {n.startedAt && n.finishedAt
                  ? `${(
                      (new Date(n.finishedAt).getTime() - new Date(n.startedAt).getTime()) /
                      1000
                    ).toFixed(1)}s`
                  : ''}
              </span>
            </div>
            {n.errorMessage ? <p className="mt-1 text-xs text-red-600">{n.errorMessage}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
