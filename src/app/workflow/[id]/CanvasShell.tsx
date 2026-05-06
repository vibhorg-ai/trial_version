'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { ChevronLeft, Download, History, Trash2, Upload } from 'lucide-react';
import { useWorkflowStore } from '../../../lib/store/workflowStore';
import { WorkflowGraphSchema, type WorkflowGraph } from '../../../lib/schemas/workflow';
import { Canvas } from './Canvas';
import { RunButton } from '../../../components/canvas/RunButton';
import { RealtimeBridge } from '../../../components/canvas/RealtimeBridge';
import { HistoryPanel } from '../../../components/history/HistoryPanel';
import { useCanvasKeyboard } from './useCanvasKeyboard';
import { useAutoSave } from './useAutoSave';

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

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-zinc-200 bg-white px-4 py-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
          Dashboard
        </Link>
        <div className="flex flex-1 items-center gap-3">
          <h1 className="text-lg font-semibold text-zinc-900">{name || workflowName}</h1>
          {saveStatus === 'saving' && (
            <span className="text-xs font-medium text-zinc-500" aria-live="polite">
              Saving…
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs font-medium text-emerald-600" aria-live="polite">
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs font-medium text-red-600" aria-live="polite">
              Save failed
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              aria-pressed={historyOpen}
              aria-label="Toggle run history"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <History aria-hidden className="h-4 w-4" />
              History
            </button>
            <RunButton />
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Import workflow JSON file"
            />
            <button
              type="button"
              onClick={handleImportClick}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              aria-label="Import workflow from JSON"
            >
              <Upload aria-hidden className="h-4 w-4" />
              Import
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              aria-label="Export workflow as JSON"
            >
              <Download aria-hidden className="h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Delete selected"
            >
              <Trash2 aria-hidden className="h-4 w-4" />
              Delete
            </button>
          </div>
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
      <RealtimeBridge />
      <div className="flex-1 bg-white">
        <Canvas />
      </div>
      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        workflowId={workflowId}
      />
    </div>
  );
}
