'use client';

import type { ReactNode } from 'react';
import { Handle, Position } from 'reactflow';
import type { HandleSpec } from '../../../lib/dag/handles';

export type NodeRunStatus = 'idle' | 'running' | 'success' | 'failed';

export interface BaseNodeShellProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  handles: ReadonlyArray<HandleSpec>;
  runStatus?: NodeRunStatus;
  selected?: boolean;
  children?: ReactNode;
}

const HANDLE_KIND_COLOR: Record<HandleSpec['kind'], string> = {
  text: '#a78bfa',
  image: '#34d399',
  'vision-multi': '#34d399',
  any: '#94a3b8',
};

export function BaseNodeShell({
  title,
  subtitle,
  icon,
  handles,
  runStatus = 'idle',
  selected = false,
  children,
}: BaseNodeShellProps) {
  const stateClass =
    runStatus === 'running'
      ? 'is-running'
      : runStatus === 'success'
        ? 'is-success'
        : runStatus === 'failed'
          ? 'is-failed'
          : 'is-idle';

  return (
    <div
      data-testid="node-shell"
      data-run-status={runStatus}
      className={`node-shell ${stateClass} ${selected ? 'is-selected' : ''} relative min-w-[280px] rounded-xl border border-zinc-200 bg-white shadow-sm`}
    >
      <header className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
        {icon ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            {icon}
          </span>
        ) : null}
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-zinc-900">{title}</span>
          {subtitle ? <span className="text-xs text-zinc-500">{subtitle}</span> : null}
        </div>
      </header>
      <div className="px-4 py-3">{children}</div>
      {handles.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type={h.side === 'output' ? 'source' : 'target'}
          position={h.side === 'output' ? Position.Right : Position.Left}
          style={{
            background: HANDLE_KIND_COLOR[h.kind],
            width: 10,
            height: 10,
            border: '2px solid white',
          }}
          aria-label={`${h.side} handle: ${h.id}`}
        />
      ))}
    </div>
  );
}
