export function HistoryListSkeleton() {
  return (
    <ul className="flex flex-col gap-1.5" aria-busy="true" aria-label="Loading run history">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-14 animate-pulse rounded bg-zinc-100" />
            <div className="h-4 flex-1 animate-pulse rounded bg-zinc-200" />
          </div>
        </li>
      ))}
    </ul>
  );
}
