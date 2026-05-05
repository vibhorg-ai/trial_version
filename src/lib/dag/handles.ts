import type { WorkflowNode } from '../schemas/node';

export type HandleKind = 'text' | 'image' | 'vision-multi' | 'any';
export type HandleSide = 'input' | 'output';

export interface HandleSpec {
  id: string;
  side: HandleSide;
  kind: HandleKind;
  /** Multiple incoming edges allowed (meaningful for input side only). */
  multi: boolean;
}

const CROP_HANDLES: HandleSpec[] = [
  { id: 'input-image', side: 'input', kind: 'image', multi: false },
  { id: 'output-image', side: 'output', kind: 'image', multi: false },
];

const GEMINI_HANDLES: HandleSpec[] = [
  { id: 'prompt', side: 'input', kind: 'text', multi: false },
  { id: 'system', side: 'input', kind: 'text', multi: false },
  { id: 'vision', side: 'input', kind: 'vision-multi', multi: true },
  { id: 'video', side: 'input', kind: 'image', multi: true },
  { id: 'audio', side: 'input', kind: 'image', multi: true },
  { id: 'file', side: 'input', kind: 'image', multi: true },
  { id: 'response', side: 'output', kind: 'text', multi: false },
];

const RESPONSE_HANDLES: HandleSpec[] = [{ id: 'result', side: 'input', kind: 'any', multi: false }];

export function listHandles(node: WorkflowNode): HandleSpec[] {
  switch (node.type) {
    case 'request-inputs':
      return node.data.fields.map((field) => ({
        id: field.name,
        side: 'output' as const,
        kind: field.fieldType === 'text_field' ? ('text' as const) : ('image' as const),
        multi: false,
      }));
    case 'crop-image':
      return CROP_HANDLES;
    case 'gemini':
      return GEMINI_HANDLES;
    case 'response':
      return RESPONSE_HANDLES;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

export function getHandleSpec(
  node: WorkflowNode,
  handleId: string,
  side: HandleSide,
): HandleSpec | null {
  return listHandles(node).find((h) => h.id === handleId && h.side === side) ?? null;
}

export function canConnect(source: HandleSpec, target: HandleSpec): boolean {
  if (source.side !== 'output') return false;
  if (target.side !== 'input') return false;
  if (target.kind === 'any') return true;
  if (source.kind === target.kind) return true;
  if (target.kind === 'vision-multi' && source.kind === 'image') return true;
  return false;
}

export type CanConnectResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'unknown-source-handle'
        | 'unknown-target-handle'
        | 'type-mismatch'
        | 'cannot-target-output-side'
        | 'cannot-source-from-input-side';
    };

export function canConnectByIds(
  sourceNode: WorkflowNode,
  sourceHandleId: string,
  targetNode: WorkflowNode,
  targetHandleId: string,
): CanConnectResult {
  const source = listHandles(sourceNode).find((h) => h.id === sourceHandleId);
  const target = listHandles(targetNode).find((h) => h.id === targetHandleId);

  if (!source) return { ok: false, reason: 'unknown-source-handle' };
  if (!target) return { ok: false, reason: 'unknown-target-handle' };
  if (source.side !== 'output') return { ok: false, reason: 'cannot-source-from-input-side' };
  if (target.side !== 'input') return { ok: false, reason: 'cannot-target-output-side' };
  if (canConnect(source, target)) return { ok: true };
  return { ok: false, reason: 'type-mismatch' };
}
