import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
for (const name of ['.env.local', '.env']) {
  const path = resolve(root, name);
  if (existsSync(path)) {
    config({ path });
  }
}

/**
 * One-shot migration: rewrite every workflow's saved Gemini node data so it uses
 * the canonical `DEFAULT_GEMINI_MODEL_ID`. Older rows pinned to retired Google
 * model ids (e.g. `gemini-1.5-pro`, `gemini-3.1-pro`) cause runtime 404s on
 * `generateContent` because Google removed those endpoints from `v1beta`.
 *
 * Idempotent: only writes when at least one Gemini node has a stale model.
 */

interface GraphLike {
  nodes: Array<{
    id: string;
    type: string;
    data: Record<string, unknown>;
    position: { x: number; y: number };
  }>;
  edges: unknown[];
  schemaVersion?: number;
}

async function main() {
  const [{ prisma }, { DEFAULT_GEMINI_MODEL_ID }] = await Promise.all([
    import('../src/lib/prisma'),
    import('../src/lib/gemini-model'),
  ]);

  const workflows = await prisma.workflow.findMany({
    select: { id: true, name: true, graph: true },
  });

  let touched = 0;
  for (const wf of workflows) {
    const graph = wf.graph as unknown as GraphLike | null;
    if (!graph || !Array.isArray(graph.nodes)) continue;
    let changed = false;
    for (const node of graph.nodes) {
      if (node.type !== 'gemini') continue;
      const current = node.data?.model;
      if (typeof current === 'string' && current !== DEFAULT_GEMINI_MODEL_ID) {
        node.data.model = DEFAULT_GEMINI_MODEL_ID;
        changed = true;
      }
    }
    if (changed) {
      await prisma.workflow.update({
        where: { id: wf.id },
        data: { graph: graph as unknown as never },
      });
      touched += 1;
      console.log(`[migrate-gemini-model] updated workflow ${wf.id} (${wf.name})`);
    }
  }

  console.log(`[migrate-gemini-model] done; updated ${touched}/${workflows.length} workflows`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[migrate-gemini-model] failed:', err);
  process.exit(1);
});
