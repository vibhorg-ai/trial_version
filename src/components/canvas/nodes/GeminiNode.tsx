'use client';

import { useState } from 'react';
import type { NodeProps } from 'reactflow';
import type { z } from 'zod';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { BaseNodeShell } from './BaseNodeShell';
import { listHandles } from '../../../lib/dag/handles';
import type { WorkflowNode } from '../../../lib/schemas/node';
import { GeminiNodeDataSchema } from '../../../lib/schemas/node';
import { useWorkflowStore } from '../../../lib/store/workflowStore';

type GeminiNodeData = z.infer<typeof GeminiNodeDataSchema>;

function toWorkflowNode(id: string, data: GeminiNodeData): WorkflowNode {
  return { id, type: 'gemini', position: { x: 0, y: 0 }, data };
}

export function GeminiNode({ id, data, selected }: NodeProps<GeminiNodeData>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const nodeRunStatus = useWorkflowStore((s) => s.nodeRunStatus[id] ?? 'idle');
  const baseShellStatus = nodeRunStatus === 'skipped' ? 'idle' : nodeRunStatus;
  const promptConnected = useWorkflowStore(
    useShallow((s) => s.edges.some((e) => e.target === id && e.targetHandle === 'prompt')),
  );
  const systemConnected = useWorkflowStore(
    useShallow((s) => s.edges.some((e) => e.target === id && e.targetHandle === 'system')),
  );
  const visionCount = useWorkflowStore(
    useShallow((s) => s.edges.filter((e) => e.target === id && e.targetHandle === 'vision').length),
  );

  const [systemOpen, setSystemOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const wfNode = toWorkflowNode(id, data);
  const handles = listHandles(wfNode);

  const promptGrey = promptConnected;
  const systemGrey = systemConnected;

  const promptClass = `min-h-[80px] w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-800 ${promptGrey ? 'is-greyed cursor-not-allowed opacity-45' : ''}`;
  const systemClass = `min-h-[64px] w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-800 ${systemGrey ? 'is-greyed cursor-not-allowed opacity-45' : ''}`;

  return (
    <BaseNodeShell
      title="Gemini"
      subtitle={data.model}
      icon={<Sparkles className="h-4 w-4" aria-hidden />}
      handles={handles}
      selected={selected}
      runStatus={baseShellStatus}
    >
      <div className="flex flex-col gap-3">
        <section>
          <div className="mb-1 text-xs font-medium text-zinc-700">Prompt</div>
          <textarea
            aria-label="Gemini prompt"
            className={promptClass}
            disabled={promptGrey}
            value={data.prompt}
            onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          />
        </section>

        <section>
          <button
            type="button"
            data-testid="toggle-system-prompt"
            className="flex w-full items-center gap-1 rounded py-1 text-left text-xs font-medium text-violet-700 hover:bg-violet-50"
            onClick={() => setSystemOpen((o) => !o)}
          >
            {systemOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            System prompt
          </button>
          {systemOpen ? (
            <textarea
              aria-label="Gemini system prompt"
              className={`mt-2 ${systemClass}`}
              disabled={systemGrey}
              value={data.systemPrompt}
              onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value })}
            />
          ) : null}
        </section>

        <section
          data-testid="gemini-vision-section"
          className="rounded border border-zinc-100 bg-zinc-50 px-2 py-2"
        >
          <div className="text-xs font-medium text-zinc-700">Vision (multi-image)</div>
          <p className="mt-1 text-xs text-zinc-600" data-testid="vision-count">
            {visionCount} images connected
          </p>
        </section>

        <section>
          <button
            type="button"
            data-testid="toggle-settings"
            className="flex w-full items-center gap-1 rounded py-1 text-left text-xs font-medium text-violet-700 hover:bg-violet-50"
            onClick={() => setSettingsOpen((o) => !o)}
          >
            {settingsOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            Settings
          </button>
          {settingsOpen ? (
            <label className="mt-2 flex flex-col gap-1 text-xs text-zinc-600">
              Model
              <select
                aria-label="Gemini model"
                className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-800"
                value={data.model}
                onChange={(e) => updateNodeData(id, { model: e.target.value })}
              >
                <option value="gemini-1.5-pro">gemini-1.5-pro</option>
              </select>
            </label>
          ) : null}
        </section>

        <section
          data-testid="gemini-output-section"
          className="rounded border border-dashed border-zinc-200 bg-zinc-50/80 px-2 py-3 text-center"
        >
          <div className="text-xs font-medium text-zinc-500">Response output</div>
          <p data-testid="gemini-output-placeholder" className="mt-1 text-xs text-zinc-400">
            No output yet
          </p>
        </section>
      </div>
    </BaseNodeShell>
  );
}
