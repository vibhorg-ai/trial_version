import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { ensureDefaultWorkflow } from '../../lib/seed-default-workflow';
import { prisma } from '../../lib/prisma';

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
          <button
            type="button"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
          >
            Create New Workflow
          </button>
          <UserButton />
        </div>
      </header>
      <p className="mt-4 text-sm text-zinc-600">
        {workflows.length} workflow{workflows.length === 1 ? '' : 's'} in your workspace (seed runs
        on first visit).
      </p>
      <ul className="mt-8 space-y-2">
        {workflows.map((w) => (
          <li key={w.id} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-base font-medium text-zinc-900">{w.name}</div>
            <div className="text-xs text-zinc-500">Last edited {w.updatedAt.toISOString()}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
