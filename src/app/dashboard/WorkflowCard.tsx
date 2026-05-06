'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Pencil, Trash2, Loader2 } from 'lucide-react';
import { renameWorkflow, deleteWorkflow } from './actions';

export interface WorkflowCardProps {
  workflow: {
    id: string;
    name: string;
    updatedAt: Date | string;
  };
}

type ViewState = 'view' | 'renaming' | 'confirmingDelete';

function formatRelativeEdited(date: Date | string): string {
  const now = Date.now();
  const then = typeof date === 'string' ? new Date(date).getTime() : date.getTime();
  const seconds = Math.round((then - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const abs = Math.abs(seconds);
  let relative: string;
  if (abs < 60) relative = rtf.format(seconds, 'second');
  else if (abs < 3600) relative = rtf.format(Math.round(seconds / 60), 'minute');
  else if (abs < 86400) relative = rtf.format(Math.round(seconds / 3600), 'hour');
  else relative = rtf.format(Math.round(seconds / 86400), 'day');
  return `Last edited ${relative}`;
}

export function WorkflowCard({ workflow }: WorkflowCardProps) {
  const [view, setView] = useState<ViewState>('view');
  const [renameDraft, setRenameDraft] = useState(workflow.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openRename() {
    setError(null);
    setRenameDraft(workflow.name);
    setView('renaming');
  }

  function cancelRename() {
    setError(null);
    setView('view');
  }

  function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!renameDraft.trim()) {
      setError('Name is required');
      return;
    }
    startTransition(async () => {
      const result = await renameWorkflow({ id: workflow.id, name: renameDraft.trim() });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setView('view');
    });
  }

  function openDeleteConfirm() {
    setError(null);
    setView('confirmingDelete');
  }

  function cancelDelete() {
    setError(null);
    setView('view');
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteWorkflow({ id: workflow.id });
      if (!result.ok) {
        setError(result.error);
        setView('view');
        return;
      }
      setError(null);
      setView('view');
    });
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        {view === 'view' ? (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <Link
                href={`/workflow/${workflow.id}`}
                className="text-base font-medium text-zinc-900 hover:text-violet-700"
              >
                {workflow.name}
              </Link>
              <div className="text-xs text-zinc-500">
                {formatRelativeEdited(workflow.updatedAt)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/workflow/${workflow.id}`}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Open
              </Link>
              <button
                type="button"
                aria-label="Rename workflow"
                disabled={isPending}
                onClick={openRename}
                className="rounded-lg border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                <Pencil aria-hidden className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Delete workflow"
                disabled={isPending}
                onClick={openDeleteConfirm}
                className="rounded-lg border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                <Trash2 aria-hidden className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {view === 'renaming' ? (
          <form onSubmit={handleRenameSubmit} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              className="min-w-[12rem] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-violet-600 focus:outline-none"
              aria-label="Workflow name"
              disabled={isPending}
            />
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Save
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={cancelRename}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
          </form>
        ) : null}

        {view === 'confirmingDelete' ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-zinc-700">Are you sure?</span>
            <button
              type="button"
              disabled={isPending}
              onClick={confirmDelete}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Delete
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={cancelDelete}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>
      {error ? (
        <span role="alert" className="block text-sm text-red-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}
