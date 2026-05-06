'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import type { NodeProps } from 'reactflow';
import type { z } from 'zod';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { BaseNodeShell } from './BaseNodeShell';
import { GalaxyDashedPanel, GalaxyFieldRow, GalaxyOutputSection } from './galaxy-field-layout';
import { WorkflowAnchoredHandle } from './WorkflowAnchoredHandle';
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
  const [settingsOpen, setSettingsOpen] = useState(true);

  const wfNode = toWorkflowNode(id, data);
  const handles = listHandles(wfNode);
  const h = useMemo(() => Object.fromEntries(handles.map((spec) => [spec.id, spec])), [handles]);

  const promptGrey = promptConnected;
  const systemGrey = systemConnected;

  const promptClass = `nodrag nowheel w-full min-w-0 resize-y rounded-lg border border-gray-200 bg-[#F5F5F5] p-3 text-sm text-gray-900 outline-none focus:border-indigo-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white ${promptGrey ? 'is-greyed' : ''}`;
  const systemClass = `nodrag nowheel w-full min-w-0 resize-y rounded-lg border-0 bg-transparent p-0 text-sm text-gray-900 outline-none focus:ring-0 disabled:opacity-50 dark:text-white ${systemGrey ? 'is-greyed' : ''}`;

  return (
    <BaseNodeShell
      title="Gemini"
      tooltip={`Run a ${data.model} text/vision generation step.`}
      icon={<Sparkles className="h-4 w-4" aria-hidden />}
      titleWeight="semibold"
      handles={handles}
      embeddedHandles
      selected={isSelected}
      runStatus={baseShellStatus}
    >
      <div className="space-y-4">
        <section className="relative">
          {h.prompt ? <WorkflowAnchoredHandle spec={h.prompt} anchor="left" /> : null}
          <GalaxyFieldRow label="Prompt" required>
            <div className="relative">
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
            </div>
          </GalaxyFieldRow>
        </section>

        <section>
          {systemOpen ? (
            <>
              <button
                type="button"
                data-testid="toggle-system-prompt"
                className="nodrag flex w-full items-center gap-0.5 rounded py-0.5 text-left text-[11px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                onClick={() => setSystemOpen((o) => !o)}
              >
                <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
                System prompt
              </button>
              <div className="relative mt-2">
                {h.system ? <WorkflowAnchoredHandle spec={h.system} anchor="left" /> : null}
                <GalaxyDashedPanel
                  className="hover:border-indigo-400 dark:hover:border-indigo-500"
                  padded
                >
                  <textarea
                    aria-label="Gemini system prompt"
                    placeholder="Enter text..."
                    rows={2}
                    className={systemClass}
                    disabled={systemGrey}
                    value={data.systemPrompt}
                    onMouseDown={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                    onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value })}
                  />
                </GalaxyDashedPanel>
              </div>
            </>
          ) : (
            <div className="relative">
              {h.system ? <WorkflowAnchoredHandle spec={h.system} anchor="left" /> : null}
              <button
                type="button"
                data-testid="toggle-system-prompt"
                className="nodrag flex w-full items-center gap-0.5 rounded py-0.5 text-left text-[11px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                onClick={() => setSystemOpen((o) => !o)}
              >
                <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
                System prompt
              </button>
            </div>
          )}
        </section>

        <section data-testid="gemini-vision-section" className="relative">
          {h.vision ? <WorkflowAnchoredHandle spec={h.vision} anchor="left" /> : null}
          <GalaxyFieldRow label="Vision (multi-image)">
            <GalaxyDashedPanel
              padded={visionCount === 0}
              className="hover:border-indigo-400 dark:hover:border-indigo-500"
            >
              <p
                className="mb-2 text-xs text-gray-600 dark:text-zinc-400"
                data-testid="vision-count"
              >
                {visionCount} {visionCount === 1 ? 'image' : 'images'} connected
              </p>
              {visionCount > 0 ? (
                <div data-testid="gemini-vision-thumbs" className="grid grid-cols-3 gap-2">
                  {visionImages.map((img) => (
                    <div
                      key={img.edgeId}
                      data-testid="gemini-vision-thumb"
                      data-source-node-id={img.sourceNodeId}
                      className="relative aspect-square overflow-hidden rounded-md border border-gray-200 bg-white dark:border-zinc-600"
                    >
                      {img.url ? (
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
              ) : (
                <p className="text-center text-xs text-gray-400 dark:text-zinc-500">
                  Connect image outputs to the Vision handle
                </p>
              )}
            </GalaxyDashedPanel>
          </GalaxyFieldRow>
        </section>

        <section className="relative">
          {h.video ? <WorkflowAnchoredHandle spec={h.video} anchor="left" /> : null}
          <GalaxyFieldRow label="Video (optional)">
            <GalaxyDashedPanel
              padded
              className="hover:border-indigo-400 dark:hover:border-indigo-500"
            >
              <p className="text-center text-xs text-gray-400 dark:text-zinc-500">
                Connect video outputs when your pipeline provides them
              </p>
            </GalaxyDashedPanel>
          </GalaxyFieldRow>
        </section>

        <section className="relative">
          {h.audio ? <WorkflowAnchoredHandle spec={h.audio} anchor="left" /> : null}
          <GalaxyFieldRow label="Audio (optional)">
            <GalaxyDashedPanel
              padded
              className="hover:border-indigo-400 dark:hover:border-indigo-500"
            >
              <p className="text-center text-xs text-gray-400 dark:text-zinc-500">
                Connect audio outputs when your pipeline provides them
              </p>
            </GalaxyDashedPanel>
          </GalaxyFieldRow>
        </section>

        <section className="relative">
          {h.file ? <WorkflowAnchoredHandle spec={h.file} anchor="left" /> : null}
          <GalaxyFieldRow label="File (optional)">
            <GalaxyDashedPanel
              padded
              className="hover:border-indigo-400 dark:hover:border-indigo-500"
            >
              <p className="text-center text-xs text-gray-400 dark:text-zinc-500">
                Connect file outputs when your pipeline provides them
              </p>
            </GalaxyDashedPanel>
          </GalaxyFieldRow>
        </section>

        <section>
          <button
            type="button"
            data-testid="toggle-settings"
            className="nodrag flex w-full items-center gap-0.5 rounded py-0.5 text-left text-[11px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
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
            <div className="mt-2">
              <GalaxyFieldRow label="Model">
                <select
                  aria-label="Gemini model"
                  className="nodrag w-full rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-sm font-normal text-gray-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  value={data.model}
                  onChange={(e) => updateNodeData(id, { model: e.target.value })}
                >
                  <option value={DEFAULT_GEMINI_MODEL_ID}>{DEFAULT_GEMINI_MODEL_ID}</option>
                </select>
              </GalaxyFieldRow>
            </div>
          ) : null}
        </section>

        <GalaxyOutputSection label="Response">
          <div
            data-testid="gemini-output-section"
            className={`relative flex max-h-72 min-h-[120px] items-start overflow-auto rounded-lg border border-gray-200 bg-[#F5F5F5] p-2 text-xs dark:border-zinc-700 dark:bg-zinc-800 ${
              outputText
                ? 'text-gray-700'
                : nodeRunError
                  ? 'border-red-200 bg-red-50/80 text-red-700 dark:border-red-900 dark:bg-red-950/40'
                  : 'text-gray-400 dark:text-zinc-500'
            }`}
          >
            {h.response ? <WorkflowAnchoredHandle spec={h.response} anchor="right" /> : null}
            {outputText ? (
              <p
                data-testid="gemini-output"
                className="nowheel cursor-text select-text whitespace-pre-wrap break-words leading-relaxed text-gray-700 dark:text-zinc-200"
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
              <div
                data-testid="gemini-output-placeholder"
                className="flex w-full items-center justify-center py-10 text-center"
              >
                {nodeRunStatus === 'running' ? 'Generating…' : 'No output yet'}
              </div>
            )}
          </div>
        </GalaxyOutputSection>
      </div>
    </BaseNodeShell>
  );
}
