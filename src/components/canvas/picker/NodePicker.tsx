'use client';

import { useState, useMemo, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { CATALOG, TABS, type CatalogTab, type CatalogEntry } from './NodeCatalog';

export interface NodePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (entry: CatalogEntry) => void;
}

export function NodePicker({ open, onClose, onPick }: NodePickerProps) {
  const [activeTab, setActiveTab] = useState<CatalogTab>('image');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOG.filter((entry) => {
      if (activeTab === 'recent') {
        return false;
      }
      if (entry.tab !== activeTab) return false;
      if (!q) return true;
      return entry.name.toLowerCase().includes(q) || entry.description.toLowerCase().includes(q);
    });
  }, [activeTab, query]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add a node"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[640px] w-[920px] max-w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search nodes…"
              aria-label="Search nodes"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-10 pr-3 text-sm placeholder:text-zinc-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav
          role="tablist"
          aria-label="Node categories"
          className="flex gap-1 border-b border-zinc-100 px-6 py-2"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                activeTab === tab.id
                  ? 'bg-violet-50 text-violet-700'
                  : 'text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="grid flex-1 grid-cols-1 gap-3 overflow-auto p-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-sm text-zinc-500">
              {activeTab === 'recent'
                ? 'No recent nodes yet — pick a node from another tab to get started.'
                : query
                  ? `No nodes matching "${query}".`
                  : 'No nodes in this category yet.'}
            </div>
          ) : (
            filtered.map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.id}
                  type="button"
                  disabled={!entry.enabled}
                  onClick={() => entry.enabled && onPick(entry)}
                  className={`flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-left transition ${
                    entry.enabled
                      ? 'hover:border-violet-300 hover:shadow-md'
                      : 'cursor-not-allowed opacity-50'
                  }`}
                  aria-disabled={!entry.enabled}
                  data-testid={`catalog-card-${entry.id}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                      <Icon aria-hidden className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-zinc-900">{entry.name}</span>
                  </div>
                  <p className="text-xs text-zinc-500">{entry.description}</p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
