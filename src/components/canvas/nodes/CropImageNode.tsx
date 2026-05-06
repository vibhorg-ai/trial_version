'use client';

import type { NodeProps } from 'reactflow';
import type { z } from 'zod';
import { Crop } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { BaseNodeShell } from './BaseNodeShell';
import { listHandles } from '../../../lib/dag/handles';
import type { WorkflowNode } from '../../../lib/schemas/node';
import { CropImageNodeDataSchema } from '../../../lib/schemas/node';
import { useWorkflowStore } from '../../../lib/store/workflowStore';

type CropImageNodeData = z.infer<typeof CropImageNodeDataSchema>;

function toWorkflowNode(id: string, data: CropImageNodeData): WorkflowNode {
  return { id, type: 'crop-image', position: { x: 0, y: 0 }, data };
}

export function CropImageNode({ id, data }: NodeProps<CropImageNodeData>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const isSelected = useWorkflowStore((s) => s.selectedNodeId === id);
  const nodeRunStatus = useWorkflowStore((s) => s.nodeRunStatus[id] ?? 'idle');
  const baseShellStatus = nodeRunStatus === 'skipped' ? 'idle' : nodeRunStatus;
  const inputImageConnected = useWorkflowStore(
    useShallow((s) => s.edges.some((e) => e.target === id && e.targetHandle === 'input-image')),
  );

  const wfNode = toWorkflowNode(id, data);
  const handles = listHandles(wfNode);

  const greyed = inputImageConnected;
  const fieldClass = `w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs tabular-nums text-zinc-800 ${greyed ? 'is-greyed cursor-not-allowed opacity-45' : ''}`;

  const setDim = (key: 'x' | 'y' | 'w' | 'h', raw: string) => {
    const n = raw === '' ? NaN : Number(raw);
    if (Number.isNaN(n)) return;
    const clamped = Math.min(100, Math.max(0, n));
    updateNodeData(id, { [key]: clamped });
  };

  return (
    <BaseNodeShell
      title="Crop Image"
      subtitle="Percent bounds"
      icon={<Crop className="h-4 w-4" aria-hidden />}
      handles={handles}
      selected={isSelected}
      runStatus={baseShellStatus}
    >
      <div
        data-testid="crop-params"
        className={`grid grid-cols-2 gap-3 ${greyed ? 'is-greyed' : ''}`}
      >
        <label className="flex flex-col gap-1 text-xs text-zinc-600">
          X
          <input
            type="number"
            min={0}
            max={100}
            className={fieldClass}
            disabled={greyed}
            value={data.x}
            onChange={(e) => setDim('x', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-600">
          Y
          <input
            type="number"
            min={0}
            max={100}
            className={fieldClass}
            disabled={greyed}
            value={data.y}
            onChange={(e) => setDim('y', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-600">
          Width
          <input
            type="number"
            min={0}
            max={100}
            className={fieldClass}
            disabled={greyed}
            value={data.w}
            onChange={(e) => setDim('w', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-600">
          Height
          <input
            type="number"
            min={0}
            max={100}
            className={fieldClass}
            disabled={greyed}
            value={data.h}
            onChange={(e) => setDim('h', e.target.value)}
          />
        </label>
      </div>
    </BaseNodeShell>
  );
}
