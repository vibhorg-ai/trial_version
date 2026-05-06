'use client';

import type { NodeProps } from 'reactflow';
import type { z } from 'zod';
import { FileOutput } from 'lucide-react';
import { BaseNodeShell } from './BaseNodeShell';
import { GalaxyOutputSection } from './galaxy-field-layout';
import { WorkflowAnchoredHandle } from './WorkflowAnchoredHandle';
import { listHandles } from '../../../lib/dag/handles';
import type { WorkflowNode } from '../../../lib/schemas/node';
import { ResponseNodeDataSchema } from '../../../lib/schemas/node';
import { useWorkflowStore } from '../../../lib/store/workflowStore';

type ResponseNodeData = z.infer<typeof ResponseNodeDataSchema>;

function toWorkflowNode(id: string, data: ResponseNodeData): WorkflowNode {
  return { id, type: 'response', position: { x: 0, y: 0 }, data };
}

function formatCaptured(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function ResponseNode({ id, data }: NodeProps<ResponseNodeData>) {
  const isSelected = useWorkflowStore((s) => s.selectedNodeId === id);
  const nodeRunStatus = useWorkflowStore((s) => s.nodeRunStatus[id] ?? 'idle');
  const baseShellStatus = nodeRunStatus === 'skipped' ? 'idle' : nodeRunStatus;
  const nodeRunOutput = useWorkflowStore((s) => s.nodeRunOutput[id]);
  const nodeRunError = useWorkflowStore((s) => s.nodeRunError[id]);
  const wfNode = toWorkflowNode(id, data);
  const handles = listHandles(wfNode);
  const resultSpec = handles.find((s) => s.id === 'result');

  // The Response node receives whatever its single upstream produced. The
  // persisted shape is `{ capturedValue: <string|object|null> }`; live realtime
  // updates are not emitted for the response node (it's resolved entirely
  // server-side), so this comes from /api/runs/:id/nodes hydration.
  const captured = (() => {
    if (!nodeRunOutput) return undefined;
    const o = nodeRunOutput as unknown;
    if (o && typeof o === 'object' && 'capturedValue' in o) {
      return (o as { capturedValue: unknown }).capturedValue;
    }
    return o;
  })();

  const liveImage =
    captured && typeof captured === 'object' && 'url' in (captured as object)
      ? String((captured as { url: unknown }).url)
      : null;
  const liveText =
    typeof captured === 'string'
      ? captured
      : captured &&
          typeof captured === 'object' &&
          'kind' in (captured as object) &&
          (captured as { kind: unknown }).kind === 'text' &&
          'text' in (captured as object)
        ? String((captured as { text: unknown }).text)
        : null;

  const text = liveText ?? formatCaptured(data.capturedValue);
  const placeholder = nodeRunStatus === 'running' ? 'Running…' : 'No output yet';

  return (
    <BaseNodeShell
      title="Response"
      tooltip="Connect node outputs here to define what your workflow returns. These values appear as results in Playground and API responses."
      icon={<FileOutput className="h-4 w-4" aria-hidden />}
      titleWeight="semibold"
      handles={handles}
      embeddedHandles
      selected={isSelected}
      runStatus={baseShellStatus}
    >
      <GalaxyOutputSection label="result">
        <div
          data-testid="response-body"
          className="nowheel nodrag relative max-h-72 min-h-[120px] cursor-text select-text overflow-auto rounded-lg border border-gray-200 bg-[#F5F5F5] p-2 text-xs text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          onMouseDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {resultSpec ? <WorkflowAnchoredHandle spec={resultSpec} anchor="left" /> : null}
          {liveImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              data-testid="response-image"
              src={liveImage}
              alt="Final workflow output"
              className="max-h-64 w-full rounded object-contain"
            />
          ) : text ? (
            <p className="whitespace-pre-wrap break-words">{text}</p>
          ) : nodeRunError ? (
            <span data-testid="response-error" className="text-red-700 dark:text-red-400">
              {nodeRunError}
            </span>
          ) : (
            <div className="flex min-h-[104px] items-center justify-center text-center text-gray-400 dark:text-zinc-500">
              {placeholder}
            </div>
          )}
        </div>
      </GalaxyOutputSection>
    </BaseNodeShell>
  );
}
