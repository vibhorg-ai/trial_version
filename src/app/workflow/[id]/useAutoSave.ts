'use client';

import { useEffect, useRef, useState } from 'react';
import { useWorkflowStore } from '../../../lib/store/workflowStore';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 1000;

export function useAutoSave(): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialRef = useRef(true);
  const savedFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initialRef.current = true;

    const unsubscribe = useWorkflowStore.subscribe((state, prev) => {
      if (initialRef.current && state.workflowId !== null) {
        initialRef.current = false;
        return;
      }
      if (state.nodes === prev.nodes && state.edges === prev.edges) {
        return;
      }
      if (!state.workflowId) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedFadeTimerRef.current) {
        clearTimeout(savedFadeTimerRef.current);
        savedFadeTimerRef.current = null;
      }

      setStatus('saving');

      timerRef.current = setTimeout(async () => {
        const graph = useWorkflowStore.getState().toGraph();
        const id = useWorkflowStore.getState().workflowId;
        if (!id) return;
        try {
          const res = await fetch(`/api/workflows/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ graph }),
          });
          if (!res.ok) {
            setStatus('error');
            return;
          }
          setStatus('saved');
          savedFadeTimerRef.current = setTimeout(() => {
            savedFadeTimerRef.current = null;
            setStatus((curr) => (curr === 'saved' ? 'idle' : curr));
          }, 2000);
        } catch {
          setStatus('error');
        }
      }, DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedFadeTimerRef.current) clearTimeout(savedFadeTimerRef.current);
    };
  }, []);

  return status;
}
