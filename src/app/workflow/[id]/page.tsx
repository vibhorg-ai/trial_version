import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '../../../lib/prisma';
import { WorkflowGraphSchema } from '../../../lib/schemas/workflow';
import { CanvasShell } from './CanvasShell';

export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { id } = await params;

  let row;
  try {
    row = await prisma.workflow.findUnique({
      where: { id },
      select: { id: true, userId: true, name: true, graph: true, updatedAt: true },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'P2023' || code === 'P2025') notFound();
    throw err;
  }

  if (!row || row.userId !== userId) notFound();

  const graph = WorkflowGraphSchema.parse(row.graph);

  return (
    <CanvasShell
      workflowId={row.id}
      workflowName={row.name}
      initialGraph={graph}
      updatedAt={row.updatedAt.toISOString()}
    />
  );
}
