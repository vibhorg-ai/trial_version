'use client';

import { useEffect, useRef } from 'react';
import { useRealtimeRun, useRealtimeRunsWithTag } from '@trigger.dev/react-hooks';
import { type RealtimeRunIngestPayload, useWorkflowStore } from '../../lib/store/workflowStore';

const TERMINAL_PARENT_STATUSES = new Set([
  'COMPLETED',
  'FAILED',
  'CRASHED',
  'SYSTEM_FAILURE',
  'TIMED_OUT',
  'CANCELED',
  'EXPIRED',
]);

function toIngestPayload(run: {
  id: string;
  taskIdentifier: string;
  status: string;
  tags?: string[];
  output?: unknown;
  error?: { message?: string };
}): RealtimeRunIngestPayload {
  return {
    id: run.id,
    taskIdentifier: run.taskIdentifier,
    status: run.status,
    tags: run.tags,
    output: run.output,
    error: run.error,
  };
}

export function RealtimeBridge() {
  const triggerRunId = useWorkflowStore((s) => s.triggerRunId);
  const publicAccessToken = useWorkflowStore((s) => s.publicAccessToken);
  const activeRunId = useWorkflowStore((s) => s.activeRunId);
  const ingestRealtimeUpdate = useWorkflowStore((s) => s.ingestRealtimeUpdate);
  const hydrateRunFromServer = useWorkflowStore((s) => s.hydrateRunFromServer);

  if (!triggerRunId || !publicAccessToken || !activeRunId) {
    return null;
  }

  return (
    <RealtimeBridgeInner
      triggerRunId={triggerRunId}
      publicAccessToken={publicAccessToken}
      activeRunId={activeRunId}
      ingestRealtimeUpdate={ingestRealtimeUpdate}
      hydrateRunFromServer={hydrateRunFromServer}
    />
  );
}

function RealtimeBridgeInner({
  triggerRunId,
  publicAccessToken,
  activeRunId,
  ingestRealtimeUpdate,
  hydrateRunFromServer,
}: {
  triggerRunId: string;
  publicAccessToken: string;
  activeRunId: string;
  ingestRealtimeUpdate: (u: RealtimeRunIngestPayload) => void;
  hydrateRunFromServer: (id: string) => Promise<void>;
}) {
  const { run } = useRealtimeRun(triggerRunId, {
    accessToken: publicAccessToken,
    stopOnCompletion: false,
  });
  const { runs } = useRealtimeRunsWithTag(`workflowRunId:${activeRunId}`, {
    accessToken: publicAccessToken,
  });
  const hydratedRef = useRef<string | null>(null);

  useEffect(() => {
    if (run) {
      ingestRealtimeUpdate(toIngestPayload(run));
      // When the workflow-run task reaches a terminal status, the response
      // node's captured value lives only in the database (it's set via
      // markNodeRun, never broadcast as a child run output). Hydrate it via
      // the REST endpoint so the user sees the final output on the canvas.
      if (TERMINAL_PARENT_STATUSES.has(run.status) && hydratedRef.current !== activeRunId) {
        hydratedRef.current = activeRunId;
        void hydrateRunFromServer(activeRunId);
      }
    }
  }, [run, ingestRealtimeUpdate, activeRunId, hydrateRunFromServer]);

  useEffect(() => {
    for (const r of runs ?? []) {
      ingestRealtimeUpdate(toIngestPayload(r));
    }
  }, [runs, ingestRealtimeUpdate]);

  return null;
}
