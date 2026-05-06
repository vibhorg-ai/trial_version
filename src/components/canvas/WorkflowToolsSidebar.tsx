'use client';

import { useCallback, useRef } from 'react';
import { Download, PanelLeft, PanelLeftClose, Trash2, Upload } from 'lucide-react';
import { CATALOG, type CatalogEntry } from './picker/NodeCatalog';
import { useWorkflowStore } from '../../lib/store/workflowStore';

export type WorkflowToolsSidebarProps = {
  open: boolean;
  canDelete: boolean;
  onDelete: () => void;
  onImportClick: () => void;
  onExport: () => void;
};

const squircleBtn =
  'inline-flex h-9 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800';

export function WorkflowToolsSidebar({
  open,
  canDelete,
  onDelete,
  onImportClick,
  onExport,
}: WorkflowToolsSidebarProps) {
  const addNode = useWorkflowStore((s) => s.addNode);
  const placeSeq = useRef(0);

  const handleAddFromCatalog = useCallback(
    (entry: CatalogEntry) => {
      if (!entry.create) return;
      placeSeq.current += 1;
      const n = placeSeq.current;
      const id = `${entry.id}-${n}`;
      const position = {
        x: 320 + (n % 9) * 14,
        y: 240 + ((n * 3) % 7) * 18,
      };
      addNode(entry.create(id, position));
    },
    [addNode],
  );

  return (
    <aside
      data-testid="workflow-tools-sidebar"
      aria-hidden={!open}
      className={`relative shrink-0 overflow-hidden border-gray-200 bg-white transition-[width] duration-200 ease-out dark:border-zinc-700 dark:bg-zinc-900 ${
        open ? 'w-72 border-r' : 'w-0 border-transparent'
      }`}
    >
      <div className="flex h-full w-72 flex-col gap-4 overflow-y-auto p-4">
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
            Workflow
          </h2>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className={squircleBtn}
              onClick={onImportClick}
              aria-label="Import workflow from JSON"
            >
              <Upload aria-hidden className="h-4 w-4" />
              Import
            </button>
            <button
              type="button"
              className={squircleBtn}
              onClick={onExport}
              aria-label="Export workflow as JSON"
            >
              <Download aria-hidden className="h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              className={squircleBtn}
              onClick={onDelete}
              disabled={!canDelete}
              aria-label="Delete selected"
            >
              <Trash2 aria-hidden className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
            Add blocks
          </h2>
          <ul className="flex flex-col gap-2">
            {CATALOG.filter((e) => e.enabled && e.create).map((entry) => {
              const Icon = entry.icon;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => handleAddFromCatalog(entry)}
                    className="flex w-full items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-3 text-left text-sm transition hover:border-indigo-300 hover:bg-white hover:shadow-sm dark:border-zinc-600 dark:bg-zinc-800/80 dark:hover:border-indigo-500 dark:hover:bg-zinc-800"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <Icon aria-hidden className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block font-medium text-gray-900 dark:text-white">
                        {entry.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-zinc-400">
                        {entry.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </aside>
  );
}

export function WorkflowSidebarToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? 'Close workflow tools panel' : 'Open workflow tools panel'}
      aria-expanded={open}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      {open ? (
        <PanelLeftClose aria-hidden className="h-4 w-4" />
      ) : (
        <PanelLeft aria-hidden className="h-4 w-4" />
      )}
    </button>
  );
}
