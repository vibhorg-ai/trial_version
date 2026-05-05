import type { WorkflowGraph } from '../schemas/workflow';
import type { WorkflowNode } from '../schemas/node';
import type { WorkflowEdge } from '../schemas/edge';

export type ResolvedInputs =
  | { type: 'request-inputs'; payload: Record<string, never> }
  | {
      type: 'crop-image';
      payload: {
        inputImageUrl: string | null;
        x: number;
        y: number;
        w: number;
        h: number;
      };
    }
  | {
      type: 'gemini';
      payload: {
        prompt: string;
        system: string;
        vision: string[];
        temperature: number;
        maxOutputTokens: number;
        topP: number;
        model: string;
      };
    }
  | { type: 'response'; payload: { result: unknown } };

/**
 * Per-source-handle output captured during a run. The orchestrator records
 * outputs from upstream nodes here as each one finishes; downstream nodes
 * read from this map to resolve their inputs.
 *
 * Map key: `${nodeId}::${handleId}`. The value is whatever the upstream
 * task returned for that handle — typically a string (URL or text) but
 * can be any JSON-serializable value.
 *
 * Helper functions are provided to read/write without manually
 * concatenating the key.
 */
export class OutputStore {
  private readonly entries = new Map<string, unknown>();

  set(nodeId: string, handleId: string, value: unknown): void {
    this.entries.set(this.key(nodeId, handleId), value);
  }

  get(nodeId: string, handleId: string): unknown {
    return this.entries.get(this.key(nodeId, handleId));
  }

  has(nodeId: string, handleId: string): boolean {
    return this.entries.has(this.key(nodeId, handleId));
  }

  private key(nodeId: string, handleId: string): string {
    return `${nodeId}::${handleId}`;
  }
}

/**
 * Find all incoming edges to a specific handle on the target node.
 * For most handles there's at most one (single-connection), but Gemini's
 * `vision` handle accepts multiple.
 */
function incomingEdges(
  graph: Pick<WorkflowGraph, 'edges'>,
  targetNodeId: string,
  targetHandleId: string,
): WorkflowEdge[] {
  return graph.edges.filter((e) => e.target === targetNodeId && e.targetHandle === targetHandleId);
}

/**
 * Read a single connected upstream output, throwing if the upstream output
 * isn't in the store (programming bug — orchestrator should only call
 * `resolveInputs` after all predecessors finish).
 */
function readUpstream(store: OutputStore, edge: WorkflowEdge): unknown {
  if (!store.has(edge.source, edge.sourceHandle)) {
    throw new Error(
      `Upstream output missing for ${edge.source}::${edge.sourceHandle} ` +
        `(needed by ${edge.target}::${edge.targetHandle})`,
    );
  }
  return store.get(edge.source, edge.sourceHandle);
}

export function resolveInputs(
  node: WorkflowNode,
  graph: Pick<WorkflowGraph, 'edges'>,
  outputs: OutputStore,
): ResolvedInputs {
  switch (node.type) {
    case 'request-inputs':
      return { type: 'request-inputs', payload: {} };

    case 'crop-image': {
      const inEdges = incomingEdges(graph, node.id, 'input-image');
      const inputImageUrl =
        inEdges.length > 0
          ? (readUpstream(outputs, inEdges[0]) as string | null)
          : node.data.inputImageUrl;
      return {
        type: 'crop-image',
        payload: {
          inputImageUrl,
          x: node.data.x,
          y: node.data.y,
          w: node.data.w,
          h: node.data.h,
        },
      };
    }

    case 'gemini': {
      const promptEdges = incomingEdges(graph, node.id, 'prompt');
      const systemEdges = incomingEdges(graph, node.id, 'system');
      const visionEdges = incomingEdges(graph, node.id, 'vision');

      const prompt =
        promptEdges.length > 0 ? String(readUpstream(outputs, promptEdges[0])) : node.data.prompt;
      const system =
        systemEdges.length > 0
          ? String(readUpstream(outputs, systemEdges[0]))
          : node.data.systemPrompt;

      // Stable order: sort by source nodeId, then edge id.
      const sortedVisionEdges = [...visionEdges].sort((a, b) => {
        const byNode = a.source.localeCompare(b.source);
        if (byNode !== 0) return byNode;
        return a.id.localeCompare(b.id);
      });
      const vision = sortedVisionEdges.map((e) => String(readUpstream(outputs, e)));

      return {
        type: 'gemini',
        payload: {
          prompt,
          system,
          vision,
          temperature: node.data.temperature,
          maxOutputTokens: node.data.maxOutputTokens,
          topP: node.data.topP,
          model: node.data.model,
        },
      };
    }

    case 'response': {
      const inEdges = incomingEdges(graph, node.id, 'result');
      const result = inEdges.length > 0 ? readUpstream(outputs, inEdges[0]) : null;
      return { type: 'response', payload: { result } };
    }
  }
}
