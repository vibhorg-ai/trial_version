import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { ensureDefaultWorkflow } from '../../lib/seed-default-workflow';
import { prisma } from '../../lib/prisma';
import { CreateWorkflowButton } from './CreateWorkflowButton';
import { WorkflowCard } from './WorkflowCard';

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  await ensureDefaultWorkflow(userId);
  const workflows = await prisma.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, updatedAt: true },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Workflows</h1>
        <div className="flex items-center gap-4">
          <CreateWorkflowButton />
          <UserButton />
        </div>
      </header>
      {workflows.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500">
          No workflows yet. Create your first one to get started.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {workflows.map((w) => (
            <li key={w.id}>
              <WorkflowCard workflow={w} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
