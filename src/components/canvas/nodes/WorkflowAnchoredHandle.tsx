'use client';

import type { CSSProperties } from 'react';
import { Handle, Position } from 'reactflow';
import type { HandleSpec } from '../../../lib/dag/handles';
import { HANDLE_KIND_HEX } from '../../../lib/dag/handles';

export type WorkflowAnchoredHandleProps = {
  spec: HandleSpec;
  /** Galaxy canvas: inputs sit at `left: -22px`, outputs at `right: -21px`. */
  anchor: 'left' | 'right';
};

/**
 * Renders a React Flow handle inside a Galaxy-style offset wrapper so edges
 * meet the node at each logical row instead of the card’s vertical midpoint.
 */
export function WorkflowAnchoredHandle({ spec, anchor }: WorkflowAnchoredHandleProps) {
  const isSource = spec.side === 'output';
  const color = HANDLE_KIND_HEX[spec.kind];
  const position = anchor === 'left' ? Position.Left : Position.Right;

  return (
    <div
      className={
        anchor === 'left'
          ? 'pointer-events-none absolute top-1/2 z-50 -translate-y-1/2 -left-[22px]'
          : 'pointer-events-none absolute top-1/2 z-50 -translate-y-1/2 -right-[21px]'
      }
    >
      <Handle
        id={spec.id}
        type={isSource ? 'source' : 'target'}
        position={position}
        className="workflow-handle workflow-handle--anchored pointer-events-auto"
        style={
          {
            background: color,
            borderColor: color,
            ['--handle-color' as string]: color,
          } as CSSProperties
        }
        aria-label={`${spec.side} handle: ${spec.id}`}
      />
    </div>
  );
}
