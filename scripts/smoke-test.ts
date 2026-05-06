/**
 * End-to-end smoke test for the workflow execution pipeline.
 *
 * Bypasses the HTTP API + Clerk so we can validate the orchestrator + Trigger.dev
 * tasks in isolation. Steps:
 *   1. Look up the seeded "Wireless Headphones Marketing" workflow for the active user.
 *   2. Create a WorkflowRun row with a known image URL.
 *   3. Use @trigger.dev/sdk to fire the `workflow-run` orchestrator task.
 *   4. Poll the run + node-run rows from Postgres every 2 seconds for up to 4 minutes.
 *   5. Print a clear report of what happened.
 *
 * Requires the Trigger.dev dev tunnel (`npm run trigger:dev`) to be running.
 */

import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
for (const name of ['.env.local', '.env']) {
  const p = resolve(root, name);
  if (existsSync(p)) {
    dotenvConfig({ path: p });
  }
}

/**
 * Local image asset to upload as the workflow's image input. Path resolved
 * relative to the workspace root.
 */
const LOCAL_IMAGE_PATH = resolve(
  'C:/Users/Vibhorg/.cursor/projects/c-PROJECTS-test-v2/assets/c__Users_Vibhorg_AppData_Roaming_Cursor_User_workspaceStorage_f2832a29e5fc1096351ee4326e48a58a_images_WhatsApp_Image_2026-05-06_at_15.40.30-5d64f0fe-b373-4e9a-a168-5a740682892e.png',
);

const TEST_TOPIC = 'Premium beige wireless headphones for daily commute';

const POLL_INTERVAL_MS = 2_000;
const MAX_WAIT_MS = 4 * 60_000;

function relTime(start: number): string {
  return `${((Date.now() - start) / 1000).toFixed(1)}s`;
}

async function main(): Promise<void> {
  if (!process.env.TRIGGER_SECRET_KEY) {
    throw new Error('TRIGGER_SECRET_KEY is not set in .env.local');
  }

  const { configure, tasks } = await import('@trigger.dev/sdk');
  const { prisma } = await import('../src/lib/prisma');
  const { SAMPLE_WORKFLOW_NAME } = await import('../src/lib/sample-workflow');
  const { uploadFileToTransloadit } = await import('../src/trigger/transloadit-upload');

  configure({ secretKey: process.env.TRIGGER_SECRET_KEY });

  console.log(`[smoke] Uploading test image to Transloadit: ${LOCAL_IMAGE_PATH}`);
  if (!existsSync(LOCAL_IMAGE_PATH)) {
    throw new Error(`Image not found on disk: ${LOCAL_IMAGE_PATH}`);
  }
  const imageUrl = await uploadFileToTransloadit(LOCAL_IMAGE_PATH);
  console.log(`[smoke] Uploaded → ${imageUrl}`);

  console.log('[smoke] Looking up sample workflow…');
  const workflow = await prisma.workflow.findFirst({
    where: { name: SAMPLE_WORKFLOW_NAME },
    orderBy: { updatedAt: 'desc' },
  });
  if (!workflow) {
    throw new Error(
      `No workflow named "${SAMPLE_WORKFLOW_NAME}" found in DB. Sign in once via the app first.`,
    );
  }
  console.log(`[smoke] Found workflow ${workflow.id} (user=${workflow.userId})`);

  console.log('[smoke] Creating WorkflowRun row…');
  const run = await prisma.workflowRun.create({
    data: {
      workflowId: workflow.id,
      userId: workflow.userId,
      scope: 'FULL',
      selectedNodeIds: [],
      status: 'PENDING',
      inputsSnapshot: {
        fields: {
          topic: TEST_TOPIC,
          product_image: imageUrl,
        },
      },
    },
  });
  console.log(`[smoke] Created WorkflowRun ${run.id}`);

  console.log('[smoke] Triggering orchestrator task…');
  const handle = await tasks.trigger(
    'workflow-run',
    { workflowRunId: run.id },
    {
      tags: [`workflowRunId:${run.id}`],
    },
  );
  console.log(`[smoke] Trigger.dev run id: ${handle.id}`);
  await prisma.workflowRun.update({
    where: { id: run.id },
    data: { triggerRunId: handle.id },
  });

  const t0 = Date.now();
  let lastStatus = 'PENDING';
  const seenNodeStatuses = new Map<string, string>();

  console.log('[smoke] Polling for completion (max 4 min)…');
  while (Date.now() - t0 < MAX_WAIT_MS) {
    const fresh = await prisma.workflowRun.findUnique({
      where: { id: run.id },
      include: { nodeRuns: { orderBy: { id: 'asc' } } },
    });
    if (!fresh) {
      throw new Error(`WorkflowRun ${run.id} disappeared`);
    }

    if (fresh.status !== lastStatus) {
      console.log(`[smoke] [${relTime(t0)}] Run status: ${lastStatus} → ${fresh.status}`);
      lastStatus = fresh.status;
    }

    for (const nr of fresh.nodeRuns) {
      const prev = seenNodeStatuses.get(nr.nodeId);
      if (prev !== nr.status) {
        console.log(
          `[smoke] [${relTime(t0)}] Node ${nr.nodeId} (${nr.nodeType}): ${prev ?? '(none)'} → ${nr.status}`,
        );
        if (nr.status === 'FAILED' && nr.errorMessage) {
          console.log(`[smoke]    error: ${nr.errorMessage}`);
        }
        seenNodeStatuses.set(nr.nodeId, nr.status);
      }
    }

    if (
      fresh.status === 'SUCCESS' ||
      fresh.status === 'FAILED' ||
      fresh.status === 'PARTIAL' ||
      fresh.status === 'CANCELLED'
    ) {
      console.log('');
      console.log('==================== FINAL ====================');
      console.log(`Run status: ${fresh.status}`);
      console.log(`Duration:   ${fresh.durationMs ?? '?'} ms`);
      console.log('Node runs:');
      for (const nr of fresh.nodeRuns) {
        const dur =
          nr.startedAt && nr.finishedAt
            ? `${nr.finishedAt.getTime() - nr.startedAt.getTime()} ms`
            : '?';
        console.log(`  - ${nr.nodeId.padEnd(15)} ${nr.status.padEnd(8)} ${dur}`);
        if (nr.errorMessage) {
          console.log(`      error: ${nr.errorMessage}`);
        }
        const out = nr.output as { capturedValue?: unknown; text?: string; url?: string } | null;
        if (out && nr.nodeType === 'response' && out.capturedValue !== undefined) {
          console.log(
            `      response captured: ${JSON.stringify(out.capturedValue).slice(0, 200)}`,
          );
        }
        if (out && nr.nodeType === 'gemini' && typeof out.text === 'string') {
          console.log(`      gemini text: ${out.text.slice(0, 120).replace(/\n/g, ' ')}`);
        }
        if (out && nr.nodeType === 'crop-image' && typeof out.url === 'string') {
          console.log(`      crop url: ${out.url}`);
        }
      }
      console.log('===============================================');
      break;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  if (lastStatus !== 'SUCCESS' && lastStatus !== 'FAILED' && lastStatus !== 'PARTIAL') {
    console.log(`[smoke] Timed out after ${MAX_WAIT_MS / 1000}s with status ${lastStatus}`);
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[smoke] Failed:', err);
  process.exit(1);
});
