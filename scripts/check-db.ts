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

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const counts = await Promise.all([
    prisma.workflow.count(),
    prisma.workflowRun.count(),
    prisma.nodeRun.count(),
  ]);
  console.log('[check-db] Workflow rows:', counts[0]);
  console.log('[check-db] WorkflowRun rows:', counts[1]);
  console.log('[check-db] NodeRun rows:', counts[2]);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[check-db] failed:', err);
  process.exit(1);
});
