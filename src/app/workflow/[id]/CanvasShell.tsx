'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { ChevronLeft, FileText, History, Wallet } from 'lucide-react';
import { useWorkflowStore } from '../../../lib/store/workflowStore';
import { WorkflowGraphSchema, type WorkflowGraph } from '../../../lib/schemas/workflow';
import { Canvas } from './Canvas';
import { RunButton } from '../../../components/canvas/RunButton';
import { RealtimeBridge } from '../../../components/canvas/RealtimeBridge';
import { HistoryPanel } from '../../../components/history/HistoryPanel';
import { useCanvasKeyboard } from './useCanvasKeyboard';
import { useAutoSave } from './useAutoSave';
import {
  WorkflowSidebarToggle,
  WorkflowToolsSidebar,
} from '../../../components/canvas/WorkflowToolsSidebar';

interface CanvasShellProps {
  workflowId: string;
  workflowName: string;
  initialGraph: WorkflowGraph;
  updatedAt: string;
}

export function CanvasShell({
  workflowId,
  workflowName,
  initialGraph,
  updatedAt,
}: CanvasShellProps) {
  const hydrate = useWorkflowStore((s) => s.hydrate);
  const name = useWorkflowStore((s) => s.name);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);
  const nodes = useWorkflowStore((s) => s.nodes);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  /** Galaxy-style metric pills; override with NEXT_PUBLIC_WORKFLOW_*_LABEL or replace with API. */
  const estLabel = process.env.NEXT_PUBLIC_WORKFLOW_EST_LABEL ?? 'Est 0.01 M';
  const balLabel = process.env.NEXT_PUBLIC_WORKFLOW_BAL_LABEL ?? 'Bal 5164.85 M';

  const selectedIsUndeletableNode = (() => {
    if (!selectedNodeId) return false;
    const n = nodes.find((node) => node.id === selectedNodeId);
    return n?.type === 'request-inputs' || n?.type === 'response';
  })();

  const canDelete =
    (selectedNodeId !== null && !selectedIsUndeletableNode) || selectedEdgeId !== null;

  function handleDelete() {
    if (selectedEdgeId) {
      removeEdge(selectedEdgeId);
    } else if (selectedNodeId && !selectedIsUndeletableNode) {
      removeNode(selectedNodeId);
    }
  }

  function handleExport() {
    const graph = useWorkflowStore.getState().toGraph();
    const blob = new Blob([JSON.stringify(graph, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || workflowName || 'workflow'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text) as unknown;
      const result = WorkflowGraphSchema.safeParse(json);
      if (!result.success) {
        setImportError('Invalid workflow JSON: schema validation failed');
        return;
      }
      const { workflowId: wid, name: n, updatedAt: ua } = useWorkflowStore.getState();
      if (!wid) {
        setImportError('Cannot import: workflow not loaded');
        return;
      }
      useWorkflowStore.getState().hydrate({
        workflowId: wid,
        name: n,
        graph: result.data,
        updatedAt: ua ?? new Date().toISOString(),
      });
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? `Import failed: ${err.message}` : 'Import failed');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  useEffect(() => {
    hydrate({ workflowId, name: workflowName, graph: initialGraph, updatedAt });
  }, [hydrate, workflowId, workflowName, initialGraph, updatedAt]);

  useEffect(() => {
    if (!importError) return;
    const t = setTimeout(() => setImportError(null), 4000);
    return () => clearTimeout(t);
  }, [importError]);

  useCanvasKeyboard();
  const saveStatus = useAutoSave();

  const squircleBtn =
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-800 shadow-sm transition-colors hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800';
  const metricPill =
    'inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100';
  const metricIcon = 'h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-zinc-400';
  return (
    <div className="flex h-screen flex-col bg-[#f4f4f4] dark:bg-zinc-950">
      <header
        data-testid="canvas-editor-header"
        className="flex shrink-0 items-center justify-between gap-3 px-4 py-2.5"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <WorkflowSidebarToggle open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />
          <div className="flex min-w-0 max-w-[min(100%,28rem)] items-center gap-2 rounded-full border border-gray-200 bg-white py-1.5 pl-2 pr-4 text-sm shadow-sm dark:border-zinc-600 dark:bg-zinc-900">
            <Link
              href="/dashboard"
              aria-label="Back to dashboard"
              className="inline-flex shrink-0 rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <ChevronLeft aria-hidden className="h-4 w-4" />
            </Link>
            <h1 className="min-w-0 truncate font-medium text-gray-900 dark:text-white">
              {name || workflowName}
            </h1>
          </div>
          {saveStatus === 'saving' ? (
            <span
              className="hidden shrink-0 text-xs font-medium text-gray-500 sm:inline dark:text-zinc-400"
              aria-live="polite"
            >
              Saving…
            </span>
          ) : null}
          {saveStatus === 'saved' ? (
            <span
              className="hidden shrink-0 text-xs font-medium text-emerald-600 sm:inline dark:text-emerald-400"
              aria-live="polite"
            >
              Saved
            </span>
          ) : null}
          {saveStatus === 'error' ? (
            <span
              className="hidden shrink-0 text-xs font-medium text-red-600 sm:inline dark:text-red-400"
              aria-live="polite"
            >
              Save failed
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div
            className={metricPill}
            data-testid="workflow-estimate-pill"
            title="Workflow estimate (configure via NEXT_PUBLIC_WORKFLOW_EST_LABEL)"
          >
            <FileText aria-hidden className={metricIcon} />
            <span>{estLabel}</span>
          </div>
          <div
            className={metricPill}
            data-testid="workflow-balance-pill"
            title="Account balance (configure via NEXT_PUBLIC_WORKFLOW_BAL_LABEL)"
          >
            <Wallet aria-hidden className={metricIcon} />
            <span>{balLabel}</span>
          </div>
          <RunButton variant="toolbar" />
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            aria-pressed={historyOpen}
            aria-label="Toggle run history"
            className={squircleBtn}
          >
            <History aria-hidden className="h-4 w-4 text-gray-900 dark:text-zinc-100" />
          </button>
        </div>
      </header>

      {importError ? (
        <div
          role="alert"
          className="border-b border-red-700/20 bg-red-600/95 px-4 py-2 text-sm font-medium text-white shadow-md"
        >
          {importError}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Import workflow JSON file"
      />

      <div className="relative flex min-h-0 min-w-0 flex-1">
        <WorkflowToolsSidebar
          open={sidebarOpen}
          canDelete={canDelete}
          onDelete={handleDelete}
          onImportClick={handleImportClick}
          onExport={handleExport}
        />
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <RealtimeBridge />
          <div className="workflow-canvas relative min-h-0 flex-1 overflow-hidden bg-[#F4F4F4] dark:bg-zinc-950">
            <Canvas />
          </div>
        </div>
      </div>

      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        workflowId={workflowId}
      />
    </div>
  );
}
