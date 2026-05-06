import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ensureDefaultWorkflow, ensureDemoWorkflow } from '../../lib/seed-default-workflow';
import { prisma } from '../../lib/prisma';
import { DashboardWorkflowShell } from './DashboardWorkflowShell';

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  await ensureDefaultWorkflow(userId);
  await ensureDemoWorkflow(userId);
  const workflows = await prisma.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, updatedAt: true },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <DashboardWorkflowShell initialWorkflows={workflows} />
    </main>
  );
}
