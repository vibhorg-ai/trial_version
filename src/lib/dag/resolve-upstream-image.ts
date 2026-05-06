import type { WorkflowEdge } from '../schemas/edge';
import type { WorkflowNode } from '../schemas/node';

/**
 * The shape of `nodeRunOutput[id]` for any executable node. We accept it as
 * `unknown` and narrow in the resolver — the runtime store stores Gemini text
 * outputs (`{kind:'text',text}`), Crop image outputs (`{kind:'image',url}`),
 * Request-Inputs field maps (`{fields:{[name]: string|null}}`), and Response
 * captures (`{capturedValue: ...}`). All four shapes can ultimately yield an
 * image URL; this helper centralises the narrowing so the UI stays readable.
 */
type Unknown = unknown;

interface FieldsOutput {
  fields: Record<string, unknown>;
}
interface ImageOutput {
  kind: 'image';
  url: string;
}
interface CapturedValueOutput {
  capturedValue: unknown;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function hasFields(v: unknown): v is FieldsOutput {
  return isObject(v) && 'fields' in v && isObject((v as { fields: unknown }).fields);
}
function isImageOutput(v: unknown): v is ImageOutput {
  return (
    isObject(v) &&
    'kind' in v &&
    (v as { kind: unknown }).kind === 'image' &&
    typeof (v as { url: unknown }).url === 'string'
  );
}

/** Loose image-output detector. Persisted crop-image NodeRun rows are stored
 *  as the raw Trigger task output (`{url}`) — without the `{kind:'image'}`
 *  envelope the orchestrator returns to its parent. So when hydrating runs
 *  from the API after a page reload, `nodeRunOutput['crop-1']` looks like
 *  `{url: 'https://…'}` rather than `{kind:'image', url:'…'}`. We accept
 *  both shapes here. (CropImageNode.tsx already does the same.) */
function extractImageUrlLoose(v: unknown): string | null {
  if (isImageOutput(v)) return v.url;
  if (
    isObject(v) &&
    'url' in v &&
    typeof (v as { url: unknown }).url === 'string' &&
    (v as { url: string }).url.length > 0
  ) {
    return (v as { url: string }).url;
  }
  return null;
}
function hasCapturedValue(v: unknown): v is CapturedValueOutput {
  return isObject(v) && 'capturedValue' in v;
}

/**
 * Try to extract an image URL from a single upstream node's run output for the
 * specific source handle that connects to a vision/result input.
 *
 * Returns null when the upstream hasn't produced a usable image yet (still
 * running, errored, or not the right output type) — callers should render a
 * "waiting" placeholder in that case.
 */
export function resolveUpstreamImageUrl(
  upstream: WorkflowNode | undefined,
  upstreamOutput: Unknown,
  sourceHandleId: string,
): string | null {
  if (!upstream || upstreamOutput === undefined || upstreamOutput === null) return null;

  // Request-Inputs: `{fields: {[name]: url|null}}` — sourceHandleId equals the
  // field name. We only treat the field's value as an image if the field was
  // declared with fieldType=image_field; otherwise text fields with a string
  // value would falsely render as <img>.
  if (upstream.type === 'request-inputs' && hasFields(upstreamOutput)) {
    const declaredField = upstream.data.fields.find((f) => f.name === sourceHandleId);
    if (declaredField?.fieldType !== 'image_field') return null;
    const value = upstreamOutput.fields[sourceHandleId];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  // Crop Image: persists as raw Trigger task output `{url}` (loose) but the
  // realtime path delivers `{kind:'image', url}`. Accept both.
  if (upstream.type === 'crop-image') {
    return extractImageUrlLoose(upstreamOutput);
  }

  // Response: `{capturedValue: <whatever upstream produced>}`. Drill in.
  if (upstream.type === 'response' && hasCapturedValue(upstreamOutput)) {
    return extractImageUrlLoose(upstreamOutput.capturedValue);
  }

  // Gemini outputs are text-only today; nothing to surface here.
  return null;
}

/**
 * Resolve every incoming edge that targets a particular handle on a node into
 * an image URL (or null when not yet available). Returns `[edgeId, url|null]`
 * pairs in graph-edge order so callers can render placeholders alongside real
 * thumbnails.
 */
export function resolveIncomingImages(
  nodes: ReadonlyArray<WorkflowNode>,
  edges: ReadonlyArray<WorkflowEdge>,
  outputs: Readonly<Record<string, unknown>>,
  targetNodeId: string,
  targetHandleId: string,
): Array<{
  edgeId: string;
  sourceNodeId: string;
  sourceHandleId: string;
  url: string | null;
}> {
  return edges
    .filter((e) => e.target === targetNodeId && e.targetHandle === targetHandleId)
    .map((e) => {
      const src = nodes.find((n) => n.id === e.source);
      const url = resolveUpstreamImageUrl(src, outputs[e.source], e.sourceHandle);
      return {
        edgeId: e.id,
        sourceNodeId: e.source,
        sourceHandleId: e.sourceHandle,
        url,
      };
    });
}
