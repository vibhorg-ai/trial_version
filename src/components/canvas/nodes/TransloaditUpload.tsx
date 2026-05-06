'use client';

import { useCallback, useId, useRef, useState, type ChangeEvent } from 'react';
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';

const ASSEMBLIES_URL = 'https://api2.transloadit.com/assemblies?expected=ASSEMBLY_COMPLETED';

export type TransloaditUploadProps = {
  value: string | null;
  onUpload: (url: string) => void;
  onClear: () => void;
};

function fileLabelFromUrl(url: string): string {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch {
    /* ignore */
  }
  return 'Image';
}

function firstResultSslUrl(assembly: {
  results?: Record<string, Array<{ ssl_url?: string }>>;
}): string | null {
  const results = assembly.results ?? {};
  const stepKey = Object.keys(results)[0];
  if (!stepKey) return null;
  const first = results[stepKey]?.[0];
  return first?.ssl_url ?? null;
}

export function TransloaditUpload({ value, onUpload, onClear }: TransloaditUploadProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      setError(null);
      setBusy(true);
      try {
        const signRes = await fetch('/api/transloadit/sign', { method: 'POST' });
        if (!signRes.ok) {
          throw new Error(
            signRes.status === 401 ? 'Unauthorized' : `Sign failed (${signRes.status})`,
          );
        }
        const { params, signature } = (await signRes.json()) as {
          params: string;
          signature: string;
        };

        const formData = new FormData();
        formData.append('params', params);
        formData.append('signature', signature);
        formData.append('file', file);

        const uploadRes = await fetch(ASSEMBLIES_URL, {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error(`Upload failed (${uploadRes.status})`);
        }

        const assembly = (await uploadRes.json()) as {
          error?: string;
          message?: string;
          results?: Record<string, Array<{ ssl_url?: string }>>;
        };

        const url = firstResultSslUrl(assembly);
        if (!url) {
          const reason = assembly.error ?? assembly.message ?? 'No file URL in assembly response';
          throw new Error(reason);
        }

        onUpload(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Upload failed: ${message}`);
      } finally {
        setBusy(false);
      }
    },
    [onUpload],
  );

  return (
    <div data-testid="transloadit-image-upload" className="flex flex-col gap-2">
      <input
        id={inputId}
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose image file"
        onChange={onFileChange}
        disabled={busy}
      />

      {value == null ? (
        <div className="flex flex-col items-center gap-2 rounded border border-dashed border-zinc-300 bg-white px-2 py-3">
          <ImageIcon className="h-6 w-6 text-zinc-400" aria-hidden />
          <button
            type="button"
            data-testid="transloadit-choose-file"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            onClick={triggerPicker}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" aria-hidden />
                Choose file
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded border border-zinc-200 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Uploaded image preview"
            className="h-auto max-h-24 w-auto max-w-24 shrink-0 rounded object-contain"
          />
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-xs font-medium text-zinc-800"
              title={fileLabelFromUrl(value)}
            >
              {fileLabelFromUrl(value)}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                data-testid="transloadit-replace"
                className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                onClick={triggerPicker}
                disabled={busy}
              >
                {busy ? 'Uploading…' : 'Replace'}
              </button>
              <button
                type="button"
                data-testid="transloadit-remove"
                className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                onClick={onClear}
                disabled={busy}
              >
                <Trash2 className="h-3 w-3" aria-hidden />
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
