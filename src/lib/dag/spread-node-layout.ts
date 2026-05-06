import type { WorkflowEdge } from '../schemas/edge';
import type { WorkflowNode } from '../schemas/node';

/** Galaxy cards are 380px wide (`galaxy-pixel-spec.md`). */
const NODE_WIDTH = 380;

/**
 * Horizontal gap between column edges — reference UI keeps columns “tight”:
 * ~¼–⅓ card width (see product screenshots).
 */
const COLUMN_GAP = Math.round(NODE_WIDTH / 3.2);

const STEP_X = NODE_WIDTH + COLUMN_GAP;

const ORIGIN_X = 20;
const ORIGIN_Y = 24;

/**
 * Vertical gap between stacked cards in the same column.
 * Gemini cards are tall; keep this generous so real DOM heights don’t overlap.
 */
const GAP_Y = 42;

/**
 * Estimated rendered heights for layout (world coords).
 * Gemini is intentionally **high** — the live card is taller than 680px once
 * vision/file rows + response panel are expanded; underestimating causes overlap.
 */
function estimateNodeHeight(n: WorkflowNode): number {
  switch (n.type) {
    case 'request-inputs':
      return 280;
    case 'crop-image':
      return 380;
    case 'gemini':
      return 900;
    case 'response':
      return 240;
    default: {
      const _ex: never = n;
      return _ex;
    }
  }
}

function buildPredSucc(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): {
  idSet: Set<string>;
  preds: Map<string, string[]>;
  succs: Map<string, string[]>;
} {
  const idSet = new Set(nodes.map((n) => n.id));
  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  for (const n of nodes) {
    preds.set(n.id, []);
    succs.set(n.id, []);
  }
  for (const e of edges) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
    preds.get(e.target)!.push(e.source);
    succs.get(e.source)!.push(e.target);
  }
  return { idSet, preds, succs };
}

/** Longest-path depth from sources (standard layered DAG). */
function computeDepth(nodes: WorkflowNode[], preds: Map<string, string[]>): Map<string, number> {
  const memo = new Map<string, number>();
  function dfs(id: string): number {
    if (memo.has(id)) return memo.get(id)!;
    const ps = preds.get(id) ?? [];
    const d = ps.length === 0 ? 0 : Math.max(...ps.map((p) => dfs(p))) + 1;
    memo.set(id, d);
    return d;
  }
  for (const n of nodes) dfs(n.id);
  return memo;
}

function groupByDepth(
  nodes: WorkflowNode[],
  depth: Map<string, number>,
): Map<number, WorkflowNode[]> {
  const layers = new Map<number, WorkflowNode[]>();
  for (const n of nodes) {
    const d = depth.get(n.id) ?? 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(n);
  }
  for (const list of layers.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id));
  }
  return layers;
}

function columnX(depth: number): number {
  return ORIGIN_X + depth * STEP_X;
}

function normalizeMinY(pos: Map<string, { x: number; y: number }>): void {
  let minY = Infinity;
  for (const p of pos.values()) minY = Math.min(minY, p.y);
  if (!Number.isFinite(minY) || minY >= ORIGIN_Y) return;
  const dy = ORIGIN_Y - minY;
  for (const id of pos.keys()) {
    const p = pos.get(id)!;
    pos.set(id, { x: p.x, y: p.y + dy });
  }
}

type PlaceParentsCtx = {
  layers: Map<number, WorkflowNode[]>;
  maxD: number;
  depth: Map<string, number>;
  succs: Map<string, string[]>;
  nodeById: Map<string, WorkflowNode>;
  pos: Map<string, { x: number; y: number }>;
};

/** Parents align to child bboxes; first node in a layer uses **idealY** (may be negative) — no `ORIGIN_Y` clamp — so cards center vertically instead of hugging the top. */
function placeParentLayers(ctx: PlaceParentsCtx): void {
  const { layers, maxD, depth, succs, nodeById, pos } = ctx;

  for (let d = maxD - 1; d >= 0; d--) {
    const layerNodes = layers.get(d);
    if (!layerNodes?.length) continue;

    type Row = { node: WorkflowNode; idealY: number };
    const rows: Row[] = [];

    for (const n of layerNodes) {
      const childIds = [
        ...new Set((succs.get(n.id) ?? []).filter((tid) => depth.get(tid) === d + 1)),
      ];

      if (childIds.length === 0) {
        rows.push({ node: n, idealY: 0 });
        continue;
      }

      let top = Infinity;
      let bottom = -Infinity;
      for (const cid of childIds) {
        const p = pos.get(cid);
        const child = nodeById.get(cid);
        if (!p || !child) continue;
        const h = estimateNodeHeight(child);
        top = Math.min(top, p.y);
        bottom = Math.max(bottom, p.y + h);
      }
      if (!Number.isFinite(top)) {
        rows.push({ node: n, idealY: 0 });
        continue;
      }

      const center = (top + bottom) / 2;
      const h = estimateNodeHeight(n);
      rows.push({ node: n, idealY: center - h / 2 });
    }

    rows.sort((a, b) => a.idealY - b.idealY || a.node.id.localeCompare(b.node.id));

    let prevBottom = -Infinity;
    for (const { node: n, idealY } of rows) {
      const h = estimateNodeHeight(n);
      const y = prevBottom === -Infinity ? idealY : Math.max(idealY, prevBottom + GAP_Y);
      pos.set(n.id, { x: columnX(d), y });
      prevBottom = y + h;
    }
  }
}

/**
 * Places nodes in a **horizontal hierarchical tree**:
 * - One **column** per workflow depth (longest path from sources).
 * - **X** advances by card width + a tight column gap (~⅓ card width).
 * - Within a column, cards are **stacked** with vertical gap `GAP_Y`.
 * - Parents use **true vertical centering** on their children’s bbox (ideal Y is not
 *   clamped to the top margin), then a single **min-Y normalize** lifts the whole graph.
 *
 * Tall Gemini estimates + wider `GAP_Y` prevent stacked Gemini columns from overlapping.
 */
export function layoutHorizontalWorkflowTree(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] {
  if (nodes.length === 0) return nodes;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const { preds, succs } = buildPredSucc(nodes, edges);

  if (edges.length === 0) {
    let y = 0;
    const out = [...nodes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((n) => {
        const pos = { x: ORIGIN_X, y };
        y += estimateNodeHeight(n) + GAP_Y;
        return { ...n, position: pos };
      });
    const pos = new Map(out.map((n) => [n.id, n.position]));
    normalizeMinY(pos);
    return out.map((n) => ({ ...n, position: pos.get(n.id)! }));
  }

  const depth = computeDepth(nodes, preds);
  const layers = groupByDepth(nodes, depth);
  const maxD = Math.max(...depth.values());

  const pos = new Map<string, { x: number; y: number }>();

  // Deepest column: stack top-to-bottom (relative coords; normalized at end).
  const deepest = layers.get(maxD) ?? [];
  {
    let y = 0;
    for (const n of deepest) {
      pos.set(n.id, { x: columnX(maxD), y });
      y += estimateNodeHeight(n) + GAP_Y;
    }
  }

  placeParentLayers({ layers, maxD, depth, succs, nodeById, pos });
  normalizeMinY(pos);

  return nodes.map((n) => ({
    ...n,
    position: pos.get(n.id) ?? { ...n.position },
  }));
}

/** Default workflow hydrate layout (horizontal tree). */
export function layoutCompactPipeline(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] {
  return layoutHorizontalWorkflowTree(nodes, edges);
}

/** @deprecated Prefer `layoutHorizontalWorkflowTree`. */
export function spreadOverlappingNodes(nodes: WorkflowNode[]): WorkflowNode[] {
  return layoutHorizontalWorkflowTree(nodes, []);
}
