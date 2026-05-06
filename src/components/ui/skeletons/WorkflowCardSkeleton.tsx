export function WorkflowCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-zinc-200 bg-white p-4"
      aria-busy="true"
      aria-label="Loading workflow card"
    >
      <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
      <div className="mt-2 h-3 w-48 animate-pulse rounded bg-zinc-100" />
    </div>
  );
}
