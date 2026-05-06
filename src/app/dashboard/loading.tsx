import { WorkflowCardSkeleton } from '../../components/ui/skeletons/WorkflowCardSkeleton';

export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10" aria-busy="true" aria-label="Loading dashboard">
      <header className="flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-200" />
        <div className="h-10 w-52 animate-pulse rounded-lg bg-zinc-100" />
      </header>
      <ul className="mt-8 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i}>
            <WorkflowCardSkeleton />
          </li>
        ))}
      </ul>
    </main>
  );
}
