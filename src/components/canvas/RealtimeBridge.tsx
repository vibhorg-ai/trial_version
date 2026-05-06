'use client';

import { useEffect } from 'react';
import { useRealtimeRun, useRealtimeRunsWithTag } from '@trigger.dev/react-hooks';
import { type RealtimeRunIngestPayload, useWorkflowStore } from '../../lib/store/workflowStore';

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

  if (!triggerRunId || !publicAccessToken || !activeRunId) {
    return null;
  }

  return (
    <RealtimeBridgeInner
      triggerRunId={triggerRunId}
      publicAccessToken={publicAccessToken}
      activeRunId={activeRunId}
      ingestRealtimeUpdate={ingestRealtimeUpdate}
    />
  );
}

function RealtimeBridgeInner({
  triggerRunId,
  publicAccessToken,
  activeRunId,
  ingestRealtimeUpdate,
}: {
  triggerRunId: string;
  publicAccessToken: string;
  activeRunId: string;
  ingestRealtimeUpdate: (u: RealtimeRunIngestPayload) => void;
}) {
  const { run } = useRealtimeRun(triggerRunId, {
    accessToken: publicAccessToken,
    stopOnCompletion: false,
  });
  const { runs } = useRealtimeRunsWithTag(`workflowRunId:${activeRunId}`, {
    accessToken: publicAccessToken,
  });

  useEffect(() => {
    if (run) {
      ingestRealtimeUpdate(toIngestPayload(run));
    }
  }, [run, ingestRealtimeUpdate]);

  useEffect(() => {
    for (const r of runs ?? []) {
      ingestRealtimeUpdate(toIngestPayload(r));
    }
  }, [runs, ingestRealtimeUpdate]);

  return null;
}
