import { UserButton } from '@clerk/nextjs';

export default function DashboardPage() {
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
      <p className="mt-8 text-sm text-zinc-500">
        Dashboard scaffolding. Workflow list, create / rename / delete actions land in Phase 5.
      </p>
    </main>
  );
}
