'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { CreateWorkflowButton } from './CreateWorkflowButton';
import { WorkflowCard } from './WorkflowCard';
import { deleteWorkflow, renameWorkflow } from './actions';
import { PENDING_WORKFLOW_ID_PREFIX, isPendingWorkflowId } from './workflowPending';

export type DashboardWorkflowRow = {
  id: string;
  name: string;
  updatedAt: Date | string;
};

type OptimisticAction =
  | { type: 'rename'; id: string; name: string }
  | { type: 'delete'; id: string }
  | { type: 'create'; workflow: DashboardWorkflowRow }
  | { type: 'resolveCreate'; pendingId: string; realId: string }
  | { type: 'removePending'; pendingId: string }
  | { type: 'restore'; workflow: DashboardWorkflowRow };

function reduceWorkflows(
  state: DashboardWorkflowRow[],
  action: OptimisticAction,
): DashboardWorkflowRow[] {
  if (action.type === 'rename') {
    return state.map((w) => (w.id === action.id ? { ...w, name: action.name } : w));
  }
  if (action.type === 'delete') {
    return state.filter((w) => w.id !== action.id);
  }
  if (action.type === 'create') {
    return [action.workflow, ...state];
  }
  if (action.type === 'resolveCreate') {
    return state.map((w) => (w.id === action.pendingId ? { ...w, id: action.realId } : w));
  }
  if (action.type === 'removePending') {
    return state.filter((w) => w.id !== action.pendingId);
  }
  if (action.type === 'restore') {
    return [...state, action.workflow];
  }
  return state;
}

export function DashboardWorkflowShell({
  initialWorkflows,
}: {
  initialWorkflows: DashboardWorkflowRow[];
}) {
  const router = useRouter();
  const [optimistic, applyOptimistic] = useOptimistic(initialWorkflows, reduceWorkflows);
  const [, startListTransition] = useTransition();

  return (
    <>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Workflows</h1>
        <div className="flex items-center gap-4">
          <CreateWorkflowButton
            onOptimisticCreate={(name) => {
              const pendingId = `${PENDING_WORKFLOW_ID_PREFIX}${crypto.randomUUID()}`;
              applyOptimistic({
                type: 'create',
                workflow: { id: pendingId, name, updatedAt: new Date() },
              });
              return pendingId;
            }}
            onResolveCreate={(pendingId, realId) => {
              applyOptimistic({ type: 'resolveCreate', pendingId, realId });
            }}
            onOptimisticCreateFailed={(pendingId) => {
              applyOptimistic({ type: 'removePending', pendingId });
            }}
          />
          <UserButton />
        </div>
      </header>
      {optimistic.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500">
          No workflows yet. Create your first one to get started.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {optimistic.map((w) => (
            <li key={w.id}>
              <WorkflowCard
                workflow={w}
                onRename={
                  isPendingWorkflowId(w.id)
                    ? undefined
                    : (name) => {
                        const previousName = w.name;
                        startListTransition(async () => {
                          applyOptimistic({ type: 'rename', id: w.id, name });
                          const result = await renameWorkflow({ id: w.id, name });
                          if (!result.ok) {
                            applyOptimistic({ type: 'rename', id: w.id, name: previousName });
                          } else {
                            router.refresh();
                          }
                        });
                      }
                }
                onDelete={
                  isPendingWorkflowId(w.id)
                    ? undefined
                    : () => {
                        const snapshot: DashboardWorkflowRow = { ...w };
                        startListTransition(async () => {
                          applyOptimistic({ type: 'delete', id: w.id });
                          const result = await deleteWorkflow({ id: w.id });
                          if (!result.ok) {
                            applyOptimistic({ type: 'restore', workflow: snapshot });
                          } else {
                            router.refresh();
                          }
                        });
                      }
                }
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
