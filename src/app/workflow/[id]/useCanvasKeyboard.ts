'use client';

import { useEffect } from 'react';
import { useWorkflowStore } from '../../../lib/store/workflowStore';

export function useCanvasKeyboard(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
      }

      const meta = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;

      if (meta && !shift && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        useWorkflowStore.getState().undo();
        return;
      }
      if (meta && shift && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        useWorkflowStore.getState().redo();
        return;
      }
      if (meta && !shift && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        useWorkflowStore.getState().redo();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useWorkflowStore.getState();
        if (state.selectedEdgeId) {
          e.preventDefault();
          state.removeEdge(state.selectedEdgeId);
          return;
        }
        if (state.selectedNodeId) {
          const node = state.nodes.find((n) => n.id === state.selectedNodeId);
          if (node && node.type !== 'request-inputs' && node.type !== 'response') {
            e.preventDefault();
            state.removeNode(state.selectedNodeId);
          }
          return;
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
