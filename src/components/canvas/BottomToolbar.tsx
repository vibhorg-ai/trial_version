'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { NodePicker } from './picker/NodePicker';
import { useWorkflowStore } from '../../lib/store/workflowStore';
import type { CatalogEntry } from './picker/NodeCatalog';

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
        className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2"
      >
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label="Add node"
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg transition hover:bg-violet-700 hover:shadow-xl"
        >
          <Plus aria-hidden className="h-5 w-5" />
        </button>
      </div>
      <NodePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={handlePick} />
    </>
  );
}
