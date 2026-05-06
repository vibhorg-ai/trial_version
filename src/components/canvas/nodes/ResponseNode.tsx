'use client';

import type { NodeProps } from 'reactflow';
import type { z } from 'zod';
import { MessageSquareQuote } from 'lucide-react';
import { BaseNodeShell } from './BaseNodeShell';
import { listHandles } from '../../../lib/dag/handles';
import type { WorkflowNode } from '../../../lib/schemas/node';
import { ResponseNodeDataSchema } from '../../../lib/schemas/node';

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

export function ResponseNode({ id, data, selected }: NodeProps<ResponseNodeData>) {
  const wfNode = toWorkflowNode(id, data);
  const handles = listHandles(wfNode);
  const text = formatCaptured(data.capturedValue);
  const placeholder = 'Awaiting workflow run…';

  return (
    <BaseNodeShell
      title="Response"
      subtitle="Final output"
      icon={<MessageSquareQuote className="h-4 w-4" aria-hidden />}
      handles={handles}
      selected={selected}
    >
      <div
        data-testid="response-body"
        className="min-h-[48px] rounded border border-zinc-100 bg-zinc-50 px-2 py-2 text-xs text-zinc-800"
      >
        {text ? text : <span className="text-zinc-400">{placeholder}</span>}
      </div>
    </BaseNodeShell>
  );
}
