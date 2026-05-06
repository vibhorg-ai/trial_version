'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useWorkflowStore } from '../../../lib/store/workflowStore';
import type { WorkflowGraph } from '../../../lib/schemas/workflow';

interface CanvasShellProps {
  workflowId: string;
  workflowName: string;
  initialGraph: WorkflowGraph;
  updatedAt: string;
}

export function CanvasShell({
  workflowId,
  workflowName,
  initialGraph,
  updatedAt,
}: CanvasShellProps) {
  const hydrate = useWorkflowStore((s) => s.hydrate);
  const name = useWorkflowStore((s) => s.name);

  useEffect(() => {
    hydrate({ workflowId, name: workflowName, graph: initialGraph, updatedAt });
  }, [hydrate, workflowId, workflowName, initialGraph, updatedAt]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-zinc-200 bg-white px-4 py-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
          Dashboard
        </Link>
        <h1 className="text-lg font-semibold text-zinc-900">{name || workflowName}</h1>
      </header>
      <div className="flex-1 bg-zinc-50">
        {/* Canvas mounts here in Task 6.4 */}
        <div className="flex h-full items-center justify-center text-sm text-zinc-400">
          Canvas mounts here in upcoming Phase 6 tasks.
        </div>
      </div>
    </div>
  );
}
