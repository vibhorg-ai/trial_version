'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Handle, Position } from 'reactflow';
import type { HandleSpec } from '../../../lib/dag/handles';
import { HANDLE_KIND_HEX } from '../../../lib/dag/handles';

export type NodeRunStatus = 'idle' | 'running' | 'success' | 'failed';

export interface BaseNodeShellProps {
  title: string;
  /** Optional tooltip text shown when hovering the info icon next to title. */
  tooltip?: string;
  /** Optional icon tile (Lucide icon) rendered to the left of the title.
   * Galaxy renders this as a 32×32 rounded-lg tile filled with `bg-accent/10`
   * and a coloured icon. Pass `null` for icon-less nodes (Request-Inputs). */
  icon?: ReactNode;
  handles: ReadonlyArray<HandleSpec>;
  runStatus?: NodeRunStatus;
  selected?: boolean;
  children?: ReactNode;
  /** Width override. Galaxy's canonical card is 380px; tests may pin smaller. */
  widthClass?: string;
  /** Whether the title row is `font-medium` (Request-Inputs) or `font-semibold`
   * (Response, Crop, Gemini). Defaults to medium. */
  titleWeight?: 'medium' | 'semibold';
  /** Optional header right-edge slot (menu button, run pill, etc.). */
  headerActions?: ReactNode;
  /** When true, the shell does not render handles; the node places `WorkflowAnchoredHandle` per row. */
  embeddedHandles?: boolean;
}

export function BaseNodeShell({
  title,
  tooltip,
  icon,
  handles,
  runStatus = 'idle',
  selected = false,
  children,
  widthClass = 'w-[380px]',
  titleWeight = 'medium',
  headerActions,
  embeddedHandles = false,
}: BaseNodeShellProps) {
  const stateClass =
    runStatus === 'running'
      ? 'is-running'
      : runStatus === 'success'
        ? 'is-success'
        : runStatus === 'failed'
          ? 'is-failed'
          : 'is-idle';

  const titleClass =
    titleWeight === 'semibold'
      ? 'text-sm font-semibold text-gray-900 dark:text-white'
      : 'text-sm font-medium text-gray-900 dark:text-white';

  return (
    <div
      data-testid="node-shell"
      data-run-status={runStatus}
      className={`node-shell ${stateClass} ${selected ? 'is-selected' : ''} relative ${widthClass}`}
      style={{ overflow: 'visible' }}
    >
      <header className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {icon ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
              {icon}
            </span>
          ) : null}
          <span className={`min-w-0 flex-1 truncate ${titleClass}`}>{title}</span>
          {tooltip ? (
            <span
              aria-label={tooltip}
              title={tooltip}
              className="shrink-0 cursor-help text-gray-400"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </span>
          ) : null}
        </div>
        {headerActions ? (
          <div className="flex shrink-0 items-center gap-1.5">{headerActions}</div>
        ) : null}
      </header>
      <div className="px-4 py-4">{children}</div>
      {!embeddedHandles
        ? handles.map((h) => {
            const color = HANDLE_KIND_HEX[h.kind];
            const isSource = h.side === 'output';
            return (
              <Handle
                key={h.id}
                id={h.id}
                type={isSource ? 'source' : 'target'}
                position={isSource ? Position.Right : Position.Left}
                className="workflow-handle"
                style={
                  {
                    background: color,
                    borderColor: color,
                    ['--handle-color' as string]: color,
                  } as CSSProperties
                }
                aria-label={`${h.side} handle: ${h.id}`}
              />
            );
          })
        : null}
    </div>
  );
}
