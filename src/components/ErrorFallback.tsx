'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  scope?: string; // e.g., 'dashboard', 'canvas'
}

export function ErrorFallback({ error, reset, scope }: ErrorFallbackProps) {
  return (
    <main role="alert" className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
          <AlertTriangle aria-hidden className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold text-zinc-900">
          Something went wrong{scope ? ` in ${scope}` : ''}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          We have logged the issue. Try again, or head back to your dashboard.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-zinc-400">Trace: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
