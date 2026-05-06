export function CanvasSkeleton() {
  return (
    <div
      className="flex h-screen flex-col bg-zinc-50"
      aria-busy="true"
      aria-label="Loading workflow canvas"
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-zinc-100" />
        <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="ml-auto flex gap-2">
          <div className="h-8 w-20 animate-pulse rounded-lg bg-zinc-100" />
          <div className="h-8 w-16 animate-pulse rounded-lg bg-zinc-100" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 p-4">
        <div className="h-full min-h-[360px] w-full animate-pulse rounded-xl border border-zinc-200 bg-zinc-100/80" />
      </div>
    </div>
  );
}
