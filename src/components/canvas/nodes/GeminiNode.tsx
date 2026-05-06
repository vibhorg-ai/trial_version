'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import type { NodeProps } from 'reactflow';
import type { z } from 'zod';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { BaseNodeShell } from './BaseNodeShell';
import { listHandles } from '../../../lib/dag/handles';
import type { WorkflowNode } from '../../../lib/schemas/node';
import { GeminiNodeDataSchema } from '../../../lib/schemas/node';
import { useWorkflowStore } from '../../../lib/store/workflowStore';
import { DEFAULT_GEMINI_MODEL_ID } from '../../../lib/gemini-model';
import { resolveIncomingImages } from '../../../lib/dag/resolve-upstream-image';

type GeminiNodeData = z.infer<typeof GeminiNodeDataSchema>;

function toWorkflowNode(id: string, data: GeminiNodeData): WorkflowNode {
  return { id, type: 'gemini', position: { x: 0, y: 0 }, data };
}

/** Hosts whose images are listed in `next.config.ts → images.remotePatterns`.
 *  Anything outside this set falls back to `unoptimized` so the optimizer
 *  doesn't 400 on us — keep this in sync with the config. */
const OPTIMIZABLE_HOSTS = [/(^|\.)transloadit\.com$/i, /(^|\.)tlcdn\.com$/i];
function isOptimizableHost(url: string): boolean {
  try {
    const u = new URL(url);
    return OPTIMIZABLE_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

export function GeminiNode({ id, data }: NodeProps<GeminiNodeData>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const isSelected = useWorkflowStore((s) => s.selectedNodeId === id);
  const nodeRunStatus = useWorkflowStore((s) => s.nodeRunStatus[id] ?? 'idle');
  const baseShellStatus = nodeRunStatus === 'skipped' ? 'idle' : nodeRunStatus;
  const nodeRunOutput = useWorkflowStore((s) => s.nodeRunOutput[id]);
  const nodeRunError = useWorkflowStore((s) => s.nodeRunError[id]);
  const promptConnected = useWorkflowStore(
    useShallow((s) => s.edges.some((e) => e.target === id && e.targetHandle === 'prompt')),
  );
  const systemConnected = useWorkflowStore(
    useShallow((s) => s.edges.some((e) => e.target === id && e.targetHandle === 'system')),
  );
  const allNodes = useWorkflowStore((s) => s.nodes);
  const allEdges = useWorkflowStore((s) => s.edges);
  const allOutputs = useWorkflowStore((s) => s.nodeRunOutput);
  const visionImages = useMemo(
    () => resolveIncomingImages(allNodes, allEdges, allOutputs, id, 'vision'),
    [allNodes, allEdges, allOutputs, id],
  );
  const visionCount = visionImages.length;

  const outputText = nodeRunOutput && nodeRunOutput.kind === 'text' ? nodeRunOutput.text : null;

  const [systemOpen, setSystemOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const wfNode = toWorkflowNode(id, data);
  const handles = listHandles(wfNode);

  const promptGrey = promptConnected;
  const systemGrey = systemConnected;

  const promptClass = `nodrag nowheel w-full min-w-0 resize-y rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 ${promptGrey ? 'is-greyed' : ''}`;
  const systemClass = `nodrag nowheel w-full min-w-0 resize-y rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 ${systemGrey ? 'is-greyed' : ''}`;

  return (
    <BaseNodeShell
      title="Gemini"
      tooltip={`Run a ${data.model} text/vision generation step.`}
      icon={<Sparkles className="h-4 w-4" aria-hidden />}
      titleWeight="semibold"
      handles={handles}
      selected={isSelected}
      runStatus={baseShellStatus}
    >
      <div className="space-y-4">
        <section>
          <div className="mb-1.5 text-xs font-medium text-gray-900">
            Prompt<span className="text-red-400">*</span>
          </div>
          <textarea
            aria-label="Gemini prompt"
            placeholder="Enter text..."
            rows={3}
            className={promptClass}
            disabled={promptGrey}
            value={data.prompt}
            onMouseDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          />
        </section>

        <section>
          <button
            type="button"
            data-testid="toggle-system-prompt"
            className="flex w-full items-center gap-0.5 rounded py-0.5 text-left text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
            onClick={() => setSystemOpen((o) => !o)}
          >
            {systemOpen ? (
              <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
            )}
            System prompt
          </button>
          {systemOpen ? (
            <textarea
              aria-label="Gemini system prompt"
              placeholder="Enter text..."
              rows={2}
              className={`mt-1.5 ${systemClass}`}
              disabled={systemGrey}
              value={data.systemPrompt}
              onMouseDown={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
              onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value })}
            />
          ) : null}
        </section>

        <section
          data-testid="gemini-vision-section"
          className="space-y-2 rounded-lg bg-[#F5F5F5] p-3"
        >
          <div className="text-xs font-medium text-gray-900">Vision (multi-image)</div>
          <p className="text-xs text-gray-600" data-testid="vision-count">
            {visionCount} {visionCount === 1 ? 'image' : 'images'} connected
          </p>
          {visionCount > 0 ? (
            <div data-testid="gemini-vision-thumbs" className="grid grid-cols-3 gap-2">
              {visionImages.map((img) => (
                <div
                  key={img.edgeId}
                  data-testid="gemini-vision-thumb"
                  data-source-node-id={img.sourceNodeId}
                  className="relative aspect-square overflow-hidden rounded-md border border-gray-200 bg-white"
                >
                  {img.url ? (
                    // Use next/image so the optimizer pipes a tiny ~150px
                    // WebP variant instead of the full multi-MB original.
                    // `unoptimized` fallback kicks in if the URL host isn't
                    // whitelisted in next.config.ts, so we never break the
                    // render even on unexpected CDN domains.
                    <Image
                      src={img.url}
                      alt={`Vision input from ${img.sourceNodeId}`}
                      fill
                      sizes="120px"
                      className="object-cover"
                      draggable={false}
                      loading="lazy"
                      unoptimized={!isOptimizableHost(img.url)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                      pending…
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section>
          <button
            type="button"
            data-testid="toggle-settings"
            className="flex w-full items-center gap-0.5 rounded py-0.5 text-left text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
            onClick={() => setSettingsOpen((o) => !o)}
          >
            {settingsOpen ? (
              <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
            )}
            Settings
          </button>
          {settingsOpen ? (
            <label className="mt-1.5 flex flex-col gap-1.5 text-xs font-medium text-gray-900">
              Model
              <select
                aria-label="Gemini model"
                className="rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-sm font-normal text-gray-900 outline-none focus:border-indigo-500"
                value={data.model}
                onChange={(e) => updateNodeData(id, { model: e.target.value })}
              >
                <option value={DEFAULT_GEMINI_MODEL_ID}>{DEFAULT_GEMINI_MODEL_ID}</option>
              </select>
            </label>
          ) : null}
        </section>

        <section
          data-testid="gemini-output-section"
          className="space-y-2 rounded-lg bg-[#F5F5F5] p-3"
        >
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-sm text-gray-900">Response</span>
          </div>
          <div
            className={`flex max-h-72 min-h-10 items-start overflow-auto rounded border p-2 text-xs ${
              outputText
                ? 'border-gray-200 bg-white text-gray-700'
                : nodeRunError
                  ? 'border-red-200 bg-red-50/80 text-red-700'
                  : 'border-gray-200 bg-white text-gray-400'
            }`}
          >
            {outputText ? (
              <p
                data-testid="gemini-output"
                className="nowheel cursor-text select-text whitespace-pre-wrap break-words leading-relaxed"
                onMouseDown={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
              >
                {outputText}
              </p>
            ) : nodeRunError ? (
              <p
                data-testid="gemini-output-error"
                className="nowheel whitespace-pre-wrap break-words"
                onMouseDown={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
              >
                {nodeRunError}
              </p>
            ) : (
              <span data-testid="gemini-output-placeholder" className="self-center">
                {nodeRunStatus === 'running' ? 'Generating…' : 'No output yet'}
              </span>
            )}
          </div>
        </section>
      </div>
    </BaseNodeShell>
  );
}
