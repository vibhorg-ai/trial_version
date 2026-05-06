'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { NodeProps } from 'reactflow';
import type { z } from 'zod';
import { Crop, Plus, RotateCcw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { BaseNodeShell } from './BaseNodeShell';
import { GalaxyDashedPanel, GalaxyOutputSection } from './galaxy-field-layout';
import { WorkflowAnchoredHandle } from './WorkflowAnchoredHandle';
import { listHandles } from '../../../lib/dag/handles';
import type { WorkflowNode } from '../../../lib/schemas/node';
import { CropImageNodeDataSchema } from '../../../lib/schemas/node';
import { useWorkflowStore } from '../../../lib/store/workflowStore';

type CropImageNodeData = z.infer<typeof CropImageNodeDataSchema>;
type DimKey = 'x' | 'y' | 'w' | 'h';

/** Range inputs only fire `change` on release; commit on arrow/home/end too. */
const RANGE_KEY_COMMIT = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

function toWorkflowNode(id: string, data: CropImageNodeData): WorkflowNode {
  return { id, type: 'crop-image', position: { x: 0, y: 0 }, data };
}

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
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
  const inputSpec = handles.find((s) => s.id === 'input-image');
  const outputSpec = handles.find((s) => s.id === 'output-image');

  const greyed = inputImageConnected;
  const fieldClass = `nodrag w-14 shrink-0 rounded-lg border border-gray-200 bg-[#F5F5F5] px-2 py-1.5 text-sm tabular-nums text-gray-900 outline-none focus:border-indigo-500 ${greyed ? 'is-greyed' : ''}`;

  const [draft, setDraft] = useState({ x: data.x, y: data.y, w: data.w, h: data.h });
  const suppressDraftSync = useRef(false);

  useEffect(() => {
    if (suppressDraftSync.current) return;
    setDraft({ x: data.x, y: data.y, w: data.w, h: data.h });
  }, [data.x, data.y, data.w, data.h]);

  const commitDim = (key: DimKey, raw: number) => {
    updateNodeData(id, { [key]: clampPct(raw) });
  };

  const setDimFromInput = (key: DimKey, raw: string) => {
    const n = raw === '' ? NaN : Number(raw);
    if (Number.isNaN(n)) return;
    const v = clampPct(n);
    setDraft((d) => ({ ...d, [key]: v }));
    commitDim(key, v);
  };

  const iconBtnClass =
    'nodrag inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800';

  const rows: Array<{ key: DimKey; label: string; reset: number }> = [
    { key: 'x', label: 'X Position (%)', reset: 0 },
    { key: 'y', label: 'Y Position (%)', reset: 0 },
    { key: 'w', label: 'Width (%)', reset: 100 },
    { key: 'h', label: 'Height (%)', reset: 100 },
  ];

  return (
    <BaseNodeShell
      title="Crop Image"
      tooltip="Crop a percentage region out of the input image. Percentages are 0-100 and are measured from the top-left corner."
      icon={<Crop className="h-4 w-4" aria-hidden />}
      titleWeight="semibold"
      handles={handles}
      embeddedHandles
      selected={isSelected}
      runStatus={baseShellStatus}
    >
      <div className="relative">
        {inputSpec ? <WorkflowAnchoredHandle spec={inputSpec} anchor="left" /> : null}
        <GalaxyDashedPanel
          data-testid="crop-params"
          className={`${greyed ? 'is-greyed' : ''}`}
          padded
        >
          <div className="flex flex-col gap-3">
            {rows.map(({ key, label, reset }) => (
              <div
                key={key}
                className="nodrag flex items-center gap-2"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <span className="w-[7.25rem] shrink-0 text-xs font-medium leading-tight text-gray-900 dark:text-zinc-100">
                  {label}
                </span>
                <input
                  type="range"
                  className="crop-range-input min-w-0 flex-1"
                  style={{ '--crop-fill': `${draft[key]}%` } as CSSProperties}
                  min={0}
                  max={100}
                  step={1}
                  disabled={greyed}
                  value={draft[key]}
                  aria-label={`${label} — slider`}
                  onPointerDown={() => {
                    suppressDraftSync.current = true;
                  }}
                  onChange={(e) => {
                    const v = clampPct(Number(e.target.value));
                    setDraft((d) => ({ ...d, [key]: v }));
                  }}
                  onPointerUp={(e) => {
                    const v = clampPct(Number(e.currentTarget.value));
                    setDraft((d) => ({ ...d, [key]: v }));
                    commitDim(key, v);
                    suppressDraftSync.current = false;
                  }}
                  onPointerCancel={() => {
                    suppressDraftSync.current = false;
                  }}
                  onKeyUp={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (!RANGE_KEY_COMMIT.has(e.key)) return;
                    const el = e.currentTarget;
                    queueMicrotask(() => {
                      const v = clampPct(Number(el.value));
                      setDraft((d) => ({ ...d, [key]: v }));
                      commitDim(key, v);
                    });
                  }}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={fieldClass}
                  disabled={greyed}
                  value={draft[key]}
                  aria-label={label}
                  onChange={(e) => setDimFromInput(key, e.target.value)}
                />
                <button
                  type="button"
                  className={iconBtnClass}
                  disabled={greyed}
                  aria-label={`Reset ${label}`}
                  title="Reset"
                  onClick={() => {
                    setDraft((d) => ({ ...d, [key]: reset }));
                    commitDim(key, reset);
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  className={iconBtnClass}
                  disabled={greyed}
                  aria-label={`Increase ${label} by 1`}
                  title="Add 1%"
                  onClick={() => {
                    const next = clampPct(draft[key] + 1);
                    setDraft((d) => ({ ...d, [key]: next }));
                    commitDim(key, next);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        </GalaxyDashedPanel>
      </div>

      <GalaxyOutputSection label="Cropped output">
        <div
          data-testid="crop-output"
          className="relative min-h-[120px] rounded-lg border border-gray-200 bg-[#F5F5F5] p-2 dark:border-zinc-700 dark:bg-zinc-800"
        >
          {outputSpec ? <WorkflowAnchoredHandle spec={outputSpec} anchor="right" /> : null}
          {croppedUrl ? (
            <>
              <a
                href={croppedUrl}
                target="_blank"
                rel="noreferrer"
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute right-3 top-3 z-10 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Open
              </a>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={croppedUrl}
                alt="Cropped result"
                className="block max-h-56 w-full rounded border border-gray-200 bg-white object-contain dark:border-zinc-600"
              />
            </>
          ) : nodeRunError ? (
            <div
              data-testid="crop-output-error"
              className="nowheel max-h-40 overflow-auto rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {nodeRunError}
            </div>
          ) : (
            <div className="flex min-h-[104px] items-center justify-center text-center text-xs text-gray-400 dark:text-zinc-500">
              {nodeRunStatus === 'running' ? 'Cropping…' : 'No output yet'}
            </div>
          )}
        </div>
      </GalaxyOutputSection>
    </BaseNodeShell>
  );
}
