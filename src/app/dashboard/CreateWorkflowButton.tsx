'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { createWorkflow } from './actions';

export interface CreateWorkflowButtonProps {
  /** Return a pending row id so create failures can roll back optimistic state. */
  onOptimisticCreate?: (trimmedName: string) => string;
  onResolveCreate?: (pendingId: string, realId: string) => void;
  onOptimisticCreateFailed?: (pendingId: string) => void;
}

export function CreateWorkflowButton({
  onOptimisticCreate,
  onResolveCreate,
  onOptimisticCreateFailed,
}: CreateWorkflowButtonProps = {}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setError(null);
    setExpanded(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    startTransition(async () => {
      const trimmed = name.trim();
      let pendingId: string | undefined;
      try {
        if (onOptimisticCreate) {
          pendingId = onOptimisticCreate(trimmed);
        }
        const result = await createWorkflow({ name: trimmed });
        if (!result.ok) {
          if (pendingId) {
            onOptimisticCreateFailed?.(pendingId);
          }
          setError(result.error);
          return;
        }
        if (pendingId) {
          onResolveCreate?.(pendingId, result.data.id);
        }
        reset();
        router.push(`/workflow/${result.data.id}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to create workflow';
        setError(message);
        if (pendingId) {
          onOptimisticCreateFailed?.(pendingId);
        }
      }
    });
  }

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
      >
        <Plus aria-hidden className="h-4 w-4" />
        Create New Workflow
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Workflow name"
        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
        aria-label="Workflow name"
        disabled={isPending}
      />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Create
      </button>
      <button
        type="button"
        onClick={reset}
        disabled={isPending}
        className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Cancel
      </button>
      {error ? (
        <span role="alert" className="text-sm text-red-600">
          {error}
        </span>
      ) : null}
    </form>
  );
}
