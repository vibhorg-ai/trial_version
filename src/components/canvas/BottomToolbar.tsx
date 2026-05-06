'use client';

import { useState } from 'react';
import { Plus, StickyNote } from 'lucide-react';
import { NodePicker } from './picker/NodePicker';
import { useWorkflowStore } from '../../lib/store/workflowStore';
import type { CatalogEntry } from './picker/NodeCatalog';

/**
 * Matches Galaxy.ai's bottom-center toolbar exactly:
 *   <div class="react-flow__panel mb-4 bottom center">
 *     <div class="flex items-center gap-1 rounded-xl border border-gray-200
 *                 bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur-sm">
 *       <button class="rounded-lg p-2 text-gray-700 hover:bg-gray-100">
 *         {sticky-note h-4 w-4}
 *       </button>
 *       <button class="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
 *               title="Add node">
 *         {plus h-4 w-4}
 *       </button>
 *     </div>
 *   </div>
 *
 * The previous implementation rendered a giant violet circle, which is
 * what diverged most visibly from the reference.
 */
export function BottomToolbar() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addNode = useWorkflowStore((s) => s.addNode);

  function handlePick(entry: CatalogEntry) {
    if (!entry.create) return;
    const id = `${entry.id}-${Date.now()}`;
    const position = {
      x: 320 + Math.random() * 80,
      y: 240 + Math.random() * 80,
    };
    const node = entry.create(id, position);
    addNode(node);
    setPickerOpen(false);
  }

  return (
    <>
      <div
        data-testid="bottom-toolbar"
        className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2"
      >
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-gray-200 bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            aria-label="Add note"
            title="Add note"
            disabled
            className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <StickyNote aria-hidden className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label="Add node"
            title="Add node"
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <Plus aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>
      <NodePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={handlePick} />
    </>
  );
}
