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
  const nodeRunOutput = useWorkflowStore((s) => s.nodeRunOutput[id]);
  const nodeRunError = useWorkflowStore((s) => s.nodeRunError[id]);
  const inputImageConnected = useWorkflowStore(
    useShallow((s) => s.edges.some((e) => e.target === id && e.targetHandle === 'input-image')),
  );

  const croppedUrl =
    nodeRunOutput && typeof nodeRunOutput === 'object' && 'url' in nodeRunOutput
      ? (nodeRunOutput as { url: string }).url
      : null;

  const wfNode = toWorkflowNode(id, data);
  const handles = listHandles(wfNode);

  const greyed = inputImageConnected;
  const fieldClass = `w-full rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-sm tabular-nums text-gray-900 outline-none focus:border-indigo-500 ${greyed ? 'is-greyed' : ''}`;

  const setDim = (key: 'x' | 'y' | 'w' | 'h', raw: string) => {
    const n = raw === '' ? NaN : Number(raw);
    if (Number.isNaN(n)) return;
    const clamped = Math.min(100, Math.max(0, n));
    updateNodeData(id, { [key]: clamped });
  };

  return (
    <BaseNodeShell
      title="Crop Image"
      tooltip="Crop a percentage region out of the input image. Percentages are 0-100 and are measured from the top-left corner."
      icon={<Crop className="h-4 w-4" aria-hidden />}
      titleWeight="semibold"
      handles={handles}
      selected={isSelected}
      runStatus={baseShellStatus}
    >
      <div
        data-testid="crop-params"
        className={`grid grid-cols-2 gap-x-3 gap-y-3 ${greyed ? 'is-greyed' : ''}`}
      >
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-900">
          X (%)
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
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-900">
          Y (%)
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
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-900">
          Width (%)
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
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-900">
          Height (%)
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

      {croppedUrl ? (
        <div data-testid="crop-output" className="mt-4 space-y-2 rounded-lg bg-[#F5F5F5] p-3">
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-sm text-gray-900">Cropped output</span>
            <a
              href={croppedUrl}
              target="_blank"
              rel="noreferrer"
              onMouseDown={(e) => e.stopPropagation()}
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              Open
            </a>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={croppedUrl}
            alt="Cropped result"
            className="block max-h-56 w-full rounded border border-gray-200 bg-white object-contain"
          />
        </div>
      ) : nodeRunError ? (
        <div
          data-testid="crop-output-error"
          className="nowheel mt-4 max-h-40 overflow-auto rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-xs text-red-700"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {nodeRunError}
        </div>
      ) : null}
    </BaseNodeShell>
  );
}
