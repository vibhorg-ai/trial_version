'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { useWorkflowStore } from '../../../lib/store/workflowStore';
import type { WorkflowGraph } from '../../../lib/schemas/workflow';
import { Canvas } from './Canvas';

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
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);
  const nodes = useWorkflowStore((s) => s.nodes);

  const selectedIsUndeletableNode = (() => {
    if (!selectedNodeId) return false;
    const n = nodes.find((node) => node.id === selectedNodeId);
    return n?.type === 'request-inputs' || n?.type === 'response';
  })();

  const canDelete =
    (selectedNodeId !== null && !selectedIsUndeletableNode) || selectedEdgeId !== null;

  function handleDelete() {
    if (selectedEdgeId) {
      removeEdge(selectedEdgeId);
    } else if (selectedNodeId && !selectedIsUndeletableNode) {
      removeNode(selectedNodeId);
    }
  }

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
        <div className="flex flex-1 items-center gap-4">
          <h1 className="text-lg font-semibold text-zinc-900">{name || workflowName}</h1>
          <div className="ml-auto">
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Delete selected"
            >
              <Trash2 aria-hidden className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </header>
      <div className="flex-1 bg-white">
        <Canvas />
      </div>
    </div>
  );
}
