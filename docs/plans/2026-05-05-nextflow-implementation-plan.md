# NextFlow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build NextFlow — a pixel-perfect, production-ready clone of the Galaxy.ai workflow builder scoped to LLM workflows, with type-safe DAG validation, concurrent Trigger.dev v4 orchestration, Realtime UI updates, and a full test pyramid.

**Architecture:** Next.js (App Router) frontend with Zustand-driven React Flow canvas; Clerk-gated API routes persist workflows and runs to Postgres via Prisma; a single root Trigger.dev v4 orchestrator task per run walks the DAG with a ready-set wave-walker that fans out child tasks (Crop Image, Gemini) the moment their direct upstreams complete; the browser subscribes to Trigger.dev Realtime for live glow + outputs.

**Tech Stack:** Next.js 15 (App Router) · TypeScript strict · PostgreSQL (Neon) · Prisma · Clerk · React Flow · Trigger.dev v4 · Translodit · FFmpeg via Trigger.dev · Tailwind · Zustand (immer) · Zod · `@google/generative-ai` · Lucide React · Vitest · Playwright · Sentry · Pino.

**Design doc:** `docs/plans/2026-05-05-nextflow-design.md` (read this first; it has all locked decisions).

**Mandatory attribution log:** `[NextFlow] Candidate LinkedIn: https://www.linkedin.com/in/harshuldhar` — fires once per route navigation on every page.

**GitHub remote:** `git@github.com:vibhorg-ai/trial_version.git` (empty; first push happens in Task 1.6).

---

## How to read this plan

- **10 phases**, each containing several **2–5 minute tasks**.
- Every task lists the **exact files** to create or modify.
- Every task lists **exact commands** with **expected output**.
- Every task ends with a **commit** following Conventional Commits style. We push at milestone boundaries.
- Skills referenced via `@`: `@superpowers:test-driven-development`, `@superpowers:systematic-debugging`, `@superpowers:verification-before-completion`, `@superpowers:requesting-code-review`.
- TDD is followed wherever the surface is testable in isolation. UI work uses the equivalent "write a failing component test, then make it pass" cycle. Visual-fidelity work has manual verification steps because pixel-matching cannot be unit-tested meaningfully.

---

## Phase 1 — Repository foundation (Tasks 1.1 – 1.6)

### Task 1.1: Initialize git repository and baseline `.gitignore`

**Files:**
- Create: `.gitignore`
- Create: `.gitattributes`
- Create: `.editorconfig`

**Step 1: Initialize the git repo**

```bash
git init -b main
```

Expected: `Initialized empty Git repository in c:/PROJECTS/test_v2/.git/`

**Step 2: Write `.gitignore`**

```gitignore
# Dependencies
node_modules/
.pnp.*
.yarn/

# Next.js
.next/
out/

# Vercel
.vercel/

# Trigger.dev
.trigger/
trigger-deploy.log

# Env
.env
.env.local
.env.*.local
!.env.local.example

# Prisma
prisma/.env

# Test artifacts
coverage/
playwright-report/
test-results/

# IDE
.vscode/
.idea/
.cursor/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# TypeScript
*.tsbuildinfo
next-env.d.ts
```

**Step 3: Write `.gitattributes`**

```
* text=auto eol=lf
*.{cmd,bat,ps1} text eol=crlf
```

**Step 4: Write `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

**Step 5: Verify and commit**

```bash
git status
git add .gitignore .gitattributes .editorconfig
git commit -m "chore: initial repository setup with gitignore, gitattributes, editorconfig"
```

Expected: One commit. `git status` shows working tree clean (the `docs/plans/*.md` files are still untracked; we'll add them in Task 1.2).

---

### Task 1.2: Stage and commit existing design + plan docs

**Files:**
- Add to git: `docs/plans/2026-05-05-nextflow-design.md`
- Add to git: `docs/plans/2026-05-05-nextflow-implementation-plan.md`

**Step 1: Stage and commit**

```bash
git add docs/
git commit -m "docs: add NextFlow design doc and implementation plan"
```

Expected: Working tree clean.

---

### Task 1.3: Scaffold Next.js 15 with TypeScript strict, Tailwind, ESLint

**Files:**
- Create: full Next.js scaffold via `create-next-app`

**Step 1: Run the scaffolder**

```bash
npx create-next-app@15 . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```

When prompted about overwriting existing files (the workspace already has `.gitignore`, `docs/`, etc.), answer **No** for files we already authored.

**Step 2: Verify expected structure**

```bash
ls src/app
```

Expected: `layout.tsx  page.tsx  globals.css  favicon.ico` (or similar).

**Step 3: Confirm `tsconfig.json` has `"strict": true`**

Open `tsconfig.json`. The `compilerOptions.strict` field must be `true`. If the scaffolder didn't set it, set it now.

**Step 4: Smoke-test the scaffold**

```bash
npm run build
```

Expected: Build succeeds with no errors. Warning about no app routes is fine.

**Step 5: Commit**

```bash
git add .
git commit -m "chore: scaffold Next.js 15 (App Router, TS strict, Tailwind, ESLint)"
```

---

### Task 1.4: Lock TypeScript-strict ESLint rules and add Prettier

**Files:**
- Modify: `package.json` (add `prettier`, `eslint-config-prettier`, `@typescript-eslint/*`, `lint-staged`, `husky`)
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Modify: `eslint.config.mjs` (or `.eslintrc.json` depending on what scaffold produced)

**Step 1: Install dev dependencies**

```bash
npm i -D prettier eslint-config-prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react-hooks lint-staged husky type-coverage
```

**Step 2: Write `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

**Step 3: Write `.prettierignore`**

```
.next/
node_modules/
coverage/
playwright-report/
test-results/
.trigger/
package-lock.json
```

**Step 4: Update ESLint config**

Add to the existing flat config:
- Extend `eslint-config-prettier`.
- Set `@typescript-eslint/no-explicit-any` to `'error'`.
- Set `@typescript-eslint/no-unused-vars` to `['error', { argsIgnorePattern: '^_' }]`.
- Set `react-hooks/exhaustive-deps` to `'error'`.

**Step 5: Configure Husky + lint-staged**

```bash
npx husky init
```

In `.husky/pre-commit`, replace contents with:

```bash
npx lint-staged
```

Add to `package.json`:

```json
"lint-staged": {
  "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
```

**Step 6: Verify**

```bash
npm run lint
npx prettier --check .
```

Expected: Both pass.

**Step 7: Commit**

```bash
git add .
git commit -m "chore: add Prettier, strict ESLint rules, Husky + lint-staged"
```

---

### Task 1.5: Install all locked-stack runtime dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install runtime deps**

```bash
npm i @clerk/nextjs @prisma/client prisma @reactflow/core @reactflow/background @reactflow/controls @reactflow/minimap reactflow zustand immer zod @google/generative-ai @trigger.dev/sdk @trigger.dev/react-hooks lucide-react @transloadit/react @uppy/core @uppy/transloadit @uppy/dashboard pino class-variance-authority tailwind-merge clsx
```

(Note: at writing time the `reactflow` package itself re-exports the sub-packages; but installing the explicit subpackages avoids version drift.)

**Step 2: Install dev/test deps**

```bash
npm i -D @trigger.dev/build vitest @vitest/ui @vitejs/plugin-react @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event happy-dom @playwright/test fast-check msw @sentry/nextjs
```

**Step 3: Verify versions exist and install completed**

```bash
npm ls --depth=0
```

Expected: All listed deps present, no missing peer warnings of significance.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install locked-stack runtime and test dependencies"
```

---

### Task 1.6: Add GitHub remote and initial push

**Files:** none

**Step 1: Add remote**

```bash
git remote add origin git@github.com:vibhorg-ai/trial_version.git
git remote -v
```

Expected: Two `origin` lines (fetch + push).

**Step 2: Push**

```bash
git push -u origin main
```

Expected: All four commits land on the remote `main` branch.

**Step 3: Manual verification step**

Open the GitHub repo in a browser. Confirm the four commits and the `docs/plans/` files are present.

---

## Phase 2 — Database, Clerk, and the AttributionLog (Tasks 2.1 – 2.7)

### Task 2.1: Configure Prisma with Neon and write the initial schema

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env.local.example`
- Create: `src/lib/prisma.ts`

**Step 1: Write `.env.local.example`** with the full template from design doc §9.2.

**Step 2: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql --output ../src/generated/prisma
```

**Step 3: Replace `prisma/schema.prisma`** with the full schema from design doc §5 (`Workflow`, `WorkflowRun`, `NodeRun`, three enums).

**Step 4: Create `src/lib/prisma.ts`** as a singleton with hot-reload-safe pattern:

```ts
import { PrismaClient } from '@/generated/prisma';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error', 'warn'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

**Step 5: Generate the client**

```bash
npx prisma generate
```

Expected: Client generated to `src/generated/prisma/`.

**Step 6: Commit**

```bash
git add prisma/schema.prisma src/lib/prisma.ts src/generated/prisma .env.local.example
git commit -m "feat(db): add Prisma schema (Workflow, WorkflowRun, NodeRun) and singleton client"
```

---

### Task 2.2: Run the initial migration against Neon

**Files:** none (creates `prisma/migrations/`)

**Step 1: Set `DATABASE_URL` and `DIRECT_URL` in `.env.local`** (you create the Neon project here if not done).

**Step 2: Create and apply migration**

```bash
npx prisma migrate dev --name init
```

Expected: Migration created in `prisma/migrations/<timestamp>_init/`, applied to Neon.

**Step 3: Verify in Neon dashboard or via**

```bash
npx prisma db pull
```

Expected: No diff (schema matches DB).

**Step 4: Commit**

```bash
git add prisma/migrations
git commit -m "feat(db): initial migration creating workflows, runs, node-runs tables"
```

---

### Task 2.3: Wire Clerk into the app layout and middleware

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/middleware.ts`

**Step 1: Add `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to `.env.local`** (create the Clerk app first).

**Step 2: Modify `src/app/layout.tsx`** to wrap children with `<ClerkProvider>`.

**Step 3: Create `src/middleware.ts`** using `clerkMiddleware()`:

```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) auth().protect();
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

**Step 4: Smoke test**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: redirect to `/sign-in`. Stop the dev server.

**Step 5: Commit**

```bash
git add src/app/layout.tsx src/middleware.ts
git commit -m "feat(auth): integrate Clerk middleware and provider; gate all non-auth routes"
```

---

### Task 2.4: Build the sign-in and sign-up pages

**Files:**
- Create: `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- Create: `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- Create: `src/app/(auth)/layout.tsx`

**Step 1: Create `(auth)/layout.tsx`** with a centered, themed container.

**Step 2: Create `sign-in` page** importing Clerk's `<SignIn />` with theming props.

**Step 3: Create `sign-up` page** identically with `<SignUp />`.

**Step 4: Smoke test**

`npm run dev` → visit `/sign-in` → confirm Clerk widget renders → sign up a test user → confirm redirect to `/dashboard` (which 404s for now; we'll build it next).

**Step 5: Commit**

```bash
git add src/app/\(auth\)
git commit -m "feat(auth): add sign-in and sign-up pages using Clerk components"
```

---

### Task 2.5: Build the AttributionLog component (TDD)

**Files:**
- Create: `src/components/AttributionLog.tsx`
- Create: `src/components/__tests__/AttributionLog.test.tsx`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

**Step 1: Configure Vitest**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: false,
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

`vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

**Step 2: Write the failing test**

`src/components/__tests__/AttributionLog.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { AttributionLog } from '../AttributionLog';

describe('AttributionLog', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs the exact attribution string once on mount', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<AttributionLog />);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      '[NextFlow] Candidate LinkedIn: https://www.linkedin.com/in/harshuldhar',
    );
  });

  it('does not log a second time on re-render with same pathname', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { rerender } = render(<AttributionLog />);
    rerender(<AttributionLog />);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
```

**Step 3: Run the test (expect failure)**

```bash
npm run test -- AttributionLog
```

Expected: FAIL — module not found.

**Step 4: Implement the component**

`src/components/AttributionLog.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function AttributionLog() {
  const pathname = usePathname();

  useEffect(() => {
    console.log(
      '[NextFlow] Candidate LinkedIn: https://www.linkedin.com/in/harshuldhar',
    );
  }, [pathname]);

  return null;
}
```

**Step 5: Run the test (expect pass)**

```bash
npm run test -- AttributionLog
```

Expected: PASS (both tests).

**Step 6: Mount in `src/app/layout.tsx`** so it fires on every route.

**Step 7: Commit**

```bash
git add src/components/AttributionLog.tsx src/components/__tests__/AttributionLog.test.tsx vitest.config.ts vitest.setup.ts package.json
git commit -m "feat(observability): add AttributionLog component with route-keyed one-shot console.log"
```

---

### Task 2.6: Add a placeholder dashboard page so post-sign-in redirect works

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Create: `src/app/dashboard/layout.tsx`

**Step 1: Add a minimal dashboard page** rendering `Welcome, <UserButton />, "Workflows" heading, and a "Create New Workflow" button (non-functional placeholder).

**Step 2: Smoke test**

`npm run dev` → sign in → confirm redirect to `/dashboard` → confirm AttributionLog fires once in browser console.

**Step 3: Commit**

```bash
git add src/app/dashboard
git commit -m "feat(dashboard): scaffold dashboard route shell"
```

---

### Task 2.7: Push Phase 2

```bash
git push origin main
```

---

## Phase 3 — Schemas, DAG primitives, and shared types (Tasks 3.1 – 3.6)

### Task 3.1: Define core Zod schemas (TDD)

**Files:**
- Create: `src/lib/schemas/node.ts`
- Create: `src/lib/schemas/edge.ts`
- Create: `src/lib/schemas/workflow.ts`
- Create: `src/lib/schemas/__tests__/workflow.test.ts`

**Step 1: Write failing tests** covering: valid Workflow accepted, missing fields rejected, unknown node-type rejected, invalid handle-type rejected, JSON export round-trip preserves all fields.

**Step 2: Run** `npm run test -- workflow.test`. Expect: FAIL (modules missing).

**Step 3: Implement schemas:**

- `node.ts`: `RequestInputsNodeData`, `CropImageNodeData`, `GeminiNodeData`, `ResponseNodeData`, all discriminated by `nodeType`.
- `edge.ts`: edges with `sourceHandle`, `targetHandle` typed.
- `workflow.ts`: top-level `WorkflowExportSchema` with `nodes`, `edges`, `schemaVersion: 1`.

**Step 4: Run tests** until all pass.

**Step 5: Commit**

```bash
git add src/lib/schemas
git commit -m "feat(schemas): add Zod schemas for nodes, edges, and workflow JSON export"
```

---

### Task 3.2: Implement handle type-compatibility (TDD)

**Files:**
- Create: `src/lib/dag/handle-types.ts`
- Create: `src/lib/dag/__tests__/handle-types.test.ts`

**Step 1: Write failing tests:**
- `image` output → `image` input → allowed
- `image` output → `text` input → rejected
- `text` output → `text` input → allowed
- `text` output → `image` input → rejected
- `text` output → multiple-acceptance Vision input on Gemini → allowed (Vision accepts both `text` and `image`?)

(Resolve any ambiguity using design doc §6.4 / §8.4 — Vision accepts `image` only.)

**Step 2: Run** test, expect FAIL.

**Step 3: Implement** `canConnectHandle(sourceHandleType, targetHandleType)` returning boolean.

**Step 4: Run** tests, expect PASS.

**Step 5: Commit**

```bash
git add src/lib/dag/handle-types.ts src/lib/dag/__tests__/handle-types.test.ts
git commit -m "feat(dag): add type-safe handle compatibility checks"
```

---

### Task 3.3: Implement cycle detection (TDD with property-based tests)

**Files:**
- Create: `src/lib/dag/cycles.ts`
- Create: `src/lib/dag/__tests__/cycles.test.ts`

**Step 1: Write failing tests:**
- Empty graph → no cycle.
- Linear graph A→B→C → no cycle.
- Cycle A→B→C→A → cycle detected.
- Diamond A→{B,C}→D → no cycle.
- Property test: any random DAG produced by topo-sort-then-edges is acyclic.
- Property test: any graph with at least one back-edge has a cycle.

**Step 2: Run, expect FAIL.**

**Step 3: Implement** `hasCycle(nodes, edges, candidateEdge?)` using DFS coloring.

**Step 4: Run, expect PASS.**

**Step 5: Commit**

```bash
git add src/lib/dag/cycles.ts src/lib/dag/__tests__/cycles.test.ts
git commit -m "feat(dag): add cycle detection with property-based tests"
```

---

### Task 3.4: Implement `canConnect` combining type + cycle checks (TDD)

**Files:**
- Create: `src/lib/dag/can-connect.ts`
- Create: `src/lib/dag/__tests__/can-connect.test.ts`

**Step 1: Write failing tests** combining handle-type and cycle scenarios.

**Step 2 – 5:** Same TDD cycle. Implement `canConnect(graph, params): { ok: true } | { ok: false; reason: 'incompatible-types' | 'would-create-cycle' | 'duplicate-edge' }`.

**Commit:**

```bash
git add src/lib/dag/can-connect.ts src/lib/dag/__tests__/can-connect.test.ts
git commit -m "feat(dag): add canConnect combining type and cycle checks"
```

---

### Task 3.5: Implement ready-set computation and topo-walker (TDD)

**Files:**
- Create: `src/lib/dag/ready-set.ts`
- Create: `src/lib/dag/__tests__/ready-set.test.ts`

**Step 1: Write failing tests:**
- Initial ready-set on the sample workflow contains exactly Crop#1, Crop#2, Gemini#1.
- After Gemini#1 marked done, ready-set contains Gemini#2 (regardless of Crop status).
- After Crop#1, Crop#2, Gemini#2 all done, ready-set contains Final Gemini.
- Whitelist correctly skips non-selected nodes.
- Failed upstream → downstream skipped.

**Step 2 – 5:** TDD cycle. Implement `computeReadySet(nodes, edges, nodeStates, whitelist?)` and `walkDag(graph, whitelist, fireFn)` (the pure orchestrator core). Critical assertion: `walkDag` must call `fireFn` with multiple node IDs in a single tick when they're independent siblings.

**Commit:**

```bash
git add src/lib/dag/ready-set.ts src/lib/dag/__tests__/ready-set.test.ts
git commit -m "feat(dag): add ready-set computation and pure walkDag wave-walker"
```

---

### Task 3.6: Add input-resolution helpers (TDD)

**Files:**
- Create: `src/lib/dag/resolve-inputs.ts`
- Create: `src/lib/dag/__tests__/resolve-inputs.test.ts`

**Step 1: Write failing tests:**
- Manual input value used when handle not connected.
- Connected handle pulls value from upstream `outputs` map.
- Vision input with multiple connections concatenates all upstream image URLs.
- Missing required input → throws clear error.

**Step 2 – 5:** TDD cycle. Implement `resolveInputsFor(node, graph, outputs)` and `resolveResponseInput(graph, outputs)`.

**Commit:**

```bash
git add src/lib/dag/resolve-inputs.ts src/lib/dag/__tests__/resolve-inputs.test.ts
git commit -m "feat(dag): add input resolution and response-input helpers"
```

**Push Phase 3:**

```bash
git push origin main
```

---

## Phase 4 — API routes for workflow CRUD + sample seeding (Tasks 4.1 – 4.7)

### Task 4.1: Auth helper for API routes (TDD)

**Files:**
- Create: `src/lib/clerk.ts`
- Create: `src/lib/__tests__/clerk.test.ts`

**Step 1: Write failing tests:**
- `requireUserId()` returns userId when Clerk auth present.
- `requireUserId()` throws `UnauthorizedError` when not.

**Step 2 – 5:** TDD cycle. Use Clerk's `auth()` server helper.

**Commit:**

```bash
git add src/lib/clerk.ts src/lib/__tests__/clerk.test.ts
git commit -m "feat(auth): add requireUserId helper for API routes"
```

---

### Task 4.2: API route — `GET/POST /api/workflows` (TDD with API integration)

**Files:**
- Create: `src/app/api/workflows/route.ts`
- Create: `src/app/api/workflows/__tests__/route.test.ts`

**Step 1: Write failing tests:**
- Unauthenticated GET → 401.
- Authenticated GET → returns user's workflows ordered by `updatedAt` desc.
- Unauthenticated POST → 401.
- Authenticated POST with valid body → 201, returns created workflow.
- Authenticated POST with invalid body → 400 with Zod errors.

Use `msw` or direct route invocation to test.

**Step 2 – 5:** TDD cycle. Route returns JSON, validates with Zod, scopes to `userId`.

**Commit:**

```bash
git add src/app/api/workflows
git commit -m "feat(api): add GET/POST /api/workflows with Zod validation"
```

---

### Task 4.3: API routes — `GET/PATCH/DELETE /api/workflows/[id]` (TDD)

**Files:**
- Create: `src/app/api/workflows/[id]/route.ts`
- Create: `src/app/api/workflows/[id]/__tests__/route.test.ts`

**Step 1: Write failing tests:**
- GET other user's workflow → 404 (do NOT leak existence with 403).
- GET own → 200.
- PATCH renames or updates graph.
- DELETE removes workflow + cascades to runs.

**Step 2 – 5:** TDD cycle.

**Commit:**

```bash
git add src/app/api/workflows/\[id\]
git commit -m "feat(api): add per-workflow GET/PATCH/DELETE with strict tenancy"
```

---

### Task 4.4: Sample-workflow seeding helper (TDD)

**Files:**
- Create: `src/lib/seed/sample-workflow.ts`
- Create: `src/lib/seed/sample-workflow.json`
- Create: `src/lib/seed/__tests__/sample-workflow.test.ts`

**Step 1: Author `sample-workflow.json`** matching design doc §6 / brief: 7 nodes (Request-Inputs, Crop#1, Crop#2, Gemini#1, Gemini#2, Final Gemini, Response) with all edges per the brief's edge list, and the exact system prompts and crop coordinates from the brief.

**Step 2: Write failing tests:**
- `ensureSampleWorkflow(userId)` creates the workflow if absent.
- `ensureSampleWorkflow(userId)` is idempotent — second call doesn't duplicate.
- Resulting workflow validates against `WorkflowExportSchema`.

**Step 3 – 5:** TDD cycle. Use `prisma.workflow.upsert` keyed on `(userId, name)` (need a compound unique constraint added in Task 4.5).

**Commit:**

```bash
git add src/lib/seed
git commit -m "feat(seed): add idempotent sample workflow seeding helper"
```

---

### Task 4.5: Migration adding `(userId, name)` unique constraint

**Files:**
- Modify: `prisma/schema.prisma` (add `@@unique([userId, name])` to `Workflow`)
- Generated: `prisma/migrations/<ts>_workflow_user_name_unique/`

**Step 1: Edit schema.**

**Step 2: Migrate.**

```bash
npx prisma migrate dev --name workflow_user_name_unique
```

**Step 3: Re-run** `npm run test -- sample-workflow` to confirm idempotency.

**Commit:**

```bash
git add prisma
git commit -m "feat(db): add (userId, name) unique constraint on Workflow"
```

---

### Task 4.6: Hook seeding into the dashboard route loader

**Files:**
- Modify: `src/app/dashboard/page.tsx`

Convert dashboard page to a server component that calls `ensureSampleWorkflow(userId)` once on render, then fetches `prisma.workflow.findMany({ where: { userId }})`.

**Step 1 – 3: edit + smoke test (`npm run dev`, sign in fresh user, see sample workflow appear).**

**Commit:**

```bash
git add src/app/dashboard
git commit -m "feat(dashboard): seed sample workflow on first dashboard load"
```

---

### Task 4.7: Push Phase 4

```bash
git push origin main
```

---

## Phase 5 — Dashboard UI: cards, dialogs, CRUD (Tasks 5.1 – 5.6)

### Task 5.1: Dashboard layout, sidebar, header (visual)

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Create: `src/components/dashboard/Sidebar.tsx`
- Create: `src/components/dashboard/DashboardHeader.tsx`
- Create: `src/components/ui/Button.tsx` (shadcn-style base button)
- Create: `src/components/ui/Card.tsx`

Build static layout matching Galaxy.ai's dashboard (left sidebar with logo + nav + user button at bottom; main area with header bar + content area).

**Manual verification:** open dev → take a side-by-side screenshot vs Galaxy.ai dashboard → confirm visual parity (spacing, fonts, colors).

**Commit:**

```bash
git add src/app/dashboard src/components/dashboard src/components/ui
git commit -m "feat(dashboard): add sidebar, header, and shadcn-style base UI"
```

---

### Task 5.2: WorkflowCard component (TDD component test)

**Files:**
- Create: `src/components/dashboard/WorkflowCard.tsx`
- Create: `src/components/dashboard/__tests__/WorkflowCard.test.tsx`

**Step 1: Failing tests:** renders name, formatted last-edited timestamp, shows "Running" badge when `isRunning`, kebab menu opens with Open/Rename/Delete.

**Step 2 – 5:** TDD cycle.

**Commit:**

```bash
git add src/components/dashboard/WorkflowCard.tsx src/components/dashboard/__tests__/WorkflowCard.test.tsx
git commit -m "feat(dashboard): add WorkflowCard with kebab menu"
```

---

### Task 5.3: CreateWorkflowDialog (TDD)

**Files:**
- Create: `src/components/dashboard/CreateWorkflowDialog.tsx`
- Create: `src/components/dashboard/__tests__/CreateWorkflowDialog.test.tsx`
- Create: `src/components/ui/Dialog.tsx` (radix-ui-based)

**Step 1: Failing tests:** dialog opens on trigger, form validates name length, submit calls API and navigates to new workflow.

**Step 2 – 5:** TDD cycle. Use `@radix-ui/react-dialog` (install in Step 0 if not present).

**Commit:**

```bash
git add src/components
git commit -m "feat(dashboard): add CreateWorkflowDialog with form validation"
```

---

### Task 5.4: RenameDialog (TDD)

Similar pattern.

**Commit:** `feat(dashboard): add RenameDialog`

---

### Task 5.5: DeleteConfirmDialog (TDD)

Similar pattern. Confirms with destructive-styled button. Cascades server-side via API.

**Commit:** `feat(dashboard): add DeleteConfirmDialog`

---

### Task 5.6: Empty state + push Phase 5

**Files:**
- Create: `src/components/dashboard/EmptyState.tsx`

If user has no workflows (shouldn't happen since sample auto-seeds, but cover anyway): render a friendly empty state with a big "Create New Workflow" button.

**Manual verification:** create, rename, delete a workflow end-to-end in browser.

**Commit + push:**

```bash
git add src/components/dashboard/EmptyState.tsx
git commit -m "feat(dashboard): add empty-state for users with no workflows"
git push origin main
```

---

## Phase 6 — Workflow canvas shell + Zustand store (Tasks 6.1 – 6.10)

### Task 6.1: Workflow page route shell

**Files:**
- Create: `src/app/workflows/[id]/page.tsx`
- Create: `src/app/workflows/[id]/layout.tsx`

Server component fetches the workflow by ID (404 on not found, 404 on wrong-user), passes serialized graph to a client component shell.

**Commit:** `feat(canvas): scaffold workflow route with server-side workflow load`

---

### Task 6.2: Zustand `graph` slice (TDD)

**Files:**
- Create: `src/lib/store/graph-slice.ts`
- Create: `src/lib/store/__tests__/graph-slice.test.ts`

**Step 1: Failing tests:**
- `addNode` adds, sets `isDirty: true`.
- `removeNodes` removes, refuses Request-Inputs / Response.
- `connect` rejects via `canConnect` for invalid drags; accepts valid.
- `updateNodeConfig` patches, sets `isDirty`.
- `hydrate(workflow)` clears dirty.
- `exportJson()` round-trips with `importJson()`.

**Step 2 – 5:** TDD cycle.

**Commit:** `feat(store): add graph slice with type-safe connect and undo-aware mutations`

---

### Task 6.3: Zustand `ui` slice with undo/redo (TDD)

**Files:**
- Create: `src/lib/store/ui-slice.ts`
- Create: `src/lib/store/__tests__/ui-slice.test.ts`

**Step 1: Failing tests:**
- `pushSnapshot` captures graph state.
- `undo` restores prior; `redo` re-applies.
- 50-entry cap respected.
- `setSelectedNodes` updates.
- `togglePicker`, `toggleHistorySidebar` work.

**Step 2 – 5:** TDD cycle.

**Commit:** `feat(store): add ui slice with undo/redo and selection`

---

### Task 6.4: Zustand `run` slice (TDD)

**Files:**
- Create: `src/lib/store/run-slice.ts`
- Create: `src/lib/store/__tests__/run-slice.test.ts`

**Step 1: Failing tests:**
- `start(scope, ids)` POSTs to `/api/runs`, populates `triggerRunId`, `publicAccessToken`.
- `ingestRealtimeUpdate(update)` updates per-node status and output.
- `reset()` clears.

Mock fetch with msw.

**Step 2 – 5:** TDD cycle.

**Commit:** `feat(store): add run slice for transient run state`

---

### Task 6.5: Zustand `history` slice (TDD)

Pattern same as `run` slice. Tests for `fetch`, `expand`, `collapse`, optimistic insert on run-start.

**Commit:** `feat(store): add history slice`

---

### Task 6.6: Combine slices into `useWorkflowStore`

**Files:**
- Create: `src/lib/store/index.ts`

Combine all four slices via `create<Store>()(immer(...))`.

**Commit:** `feat(store): combine slices into useWorkflowStore`

---

### Task 6.7: React Flow canvas wired to graph slice

**Files:**
- Create: `src/components/canvas/Canvas.tsx`
- Modify: `src/app/workflows/[id]/page.tsx` to render the canvas

Wire React Flow's `nodes`, `edges`, `onNodesChange`, `onEdgesChange`, `onConnect` to the store. Add `<Background variant={Dots} />`, `<MiniMap />`, `<Controls />`. Hydrate on mount with the loaded workflow.

**Manual verification:** open the sample workflow → see all 7 nodes positioned correctly per the screenshot.

**Commit:** `feat(canvas): wire React Flow to graph slice with background, minimap, controls`

---

### Task 6.8: Custom AnimatedPurpleEdge

**Files:**
- Create: `src/components/canvas/edges/AnimatedPurpleEdge.tsx`

Custom edge type with marching-ants stroke-dashoffset animation.

**Commit:** `feat(canvas): add AnimatedPurpleEdge with marching-ants animation`

---

### Task 6.9: Top bar with title editing, Run button placeholder, history toggle

**Files:**
- Create: `src/components/canvas/TopBar.tsx`

Title click-to-edit (PATCHes /api/workflows/[id] on blur). Run button is a placeholder for now (full wiring in Phase 8).

**Commit:** `feat(canvas): add top bar with editable title and run button placeholder`

---

### Task 6.10: Push Phase 6

```bash
git push origin main
```

---

## Phase 7 — Custom node renderers, picker, JSON I/O (Tasks 7.1 – 7.10)

### Task 7.1: BaseNodeShell with pulsating glow

**Files:**
- Create: `src/components/canvas/nodes/BaseNodeShell.tsx`
- Create: `src/components/canvas/nodes/__tests__/BaseNodeShell.test.tsx`
- Modify: `src/app/globals.css` (add `@keyframes pulse-glow`)

**Step 1: Failing test:** when `runStatus="running"`, root element has class `is-running`; when `success`, has `is-success`; etc.

**Step 2 – 5:** TDD cycle. CSS keyframe animates `box-shadow` purple ring.

**Commit:** `feat(canvas): add BaseNodeShell with pulsating-glow CSS animation`

---

### Task 7.2: RequestInputsNode (TDD)

**Files:**
- Create: `src/components/canvas/nodes/RequestInputsNode.tsx`
- Create: `src/components/canvas/nodes/__tests__/RequestInputsNode.test.tsx`

**Step 1: Failing tests:**
- Renders dynamic field list.
- Add-field popover supports `text_field` and `image_field`.
- Each field has output handle.
- text_field renders textarea; image_field renders Translodit upload widget (stub).

**Step 2 – 5:** TDD cycle.

**Commit:** `feat(canvas): add RequestInputsNode renderer`

---

### Task 7.3: CropImageNode (TDD)

**Files:**
- Create: `src/components/canvas/nodes/CropImageNode.tsx`
- Create: `src/components/canvas/nodes/__tests__/CropImageNode.test.tsx`

**Step 1: Failing tests:**
- Renders Input Image handle on left + X/Y/W/H manual inputs (default 0/0/100/100).
- Manual inputs grey out when handle is connected.
- Output Image handle on right.
- Glow class applied during run.

**Step 2 – 5:** TDD cycle.

**Commit:** `feat(canvas): add CropImageNode renderer with grey-out logic`

---

### Task 7.4: GeminiNode (TDD)

**Files:**
- Create: `src/components/canvas/nodes/GeminiNode.tsx`
- Create: `src/components/canvas/nodes/__tests__/GeminiNode.test.tsx`

Pattern same as Crop. Includes: model selector, Prompt/System Prompt/Vision/Video/Audio/File input handles, manual entries with grey-out, Output Response section with markdown rendering, collapsed Settings section.

**Commit:** `feat(canvas): add GeminiNode renderer with model selector and markdown output`

---

### Task 7.5: ResponseNode (TDD)

**Files:**
- Create: `src/components/canvas/nodes/ResponseNode.tsx`
- Create: `src/components/canvas/nodes/__tests__/ResponseNode.test.tsx`

**Step 1: Failing tests:** single `result` input handle, no output handle, renders captured value.

**Step 2 – 5:** TDD cycle.

**Commit:** `feat(canvas): add ResponseNode renderer`

---

### Task 7.6: Register all node types in the canvas

**Files:**
- Modify: `src/components/canvas/Canvas.tsx`

Pass `nodeTypes` and `edgeTypes` to React Flow.

**Manual verification:** sample workflow renders correctly with all 4 custom node types and the purple edges.

**Commit:** `feat(canvas): register custom node and edge types`

---

### Task 7.7: Bottom toolbar + NodePicker modal (TDD)

**Files:**
- Create: `src/components/canvas/BottomToolbar.tsx`
- Create: `src/components/canvas/picker/NodePicker.tsx`
- Create: `src/components/canvas/picker/__tests__/NodePicker.test.tsx`

**Step 1: Failing tests:**
- Picker opens with `+` click.
- Tabs: Recent, Image, Video, Audio, Others.
- Search filters cards.
- Crop Image card (Image tab) is functional and clickable; placeholders are disabled.
- Gemini 3.1 Pro card (Others/LLMs tab) is functional.
- Selecting a card adds the node at canvas center via `addNode` action.

**Step 2 – 5:** TDD cycle.

**Commit:** `feat(canvas): add bottom toolbar and NodePicker with tabs and search`

---

### Task 7.8: Translodit upload widget for image_field (TDD)

**Files:**
- Create: `src/components/canvas/nodes/TransloditUpload.tsx`
- Create: `src/lib/translodit.ts` (signing helpers)
- Create: `src/app/api/translodit/sign/route.ts`
- Create: `src/components/canvas/nodes/__tests__/TransloditUpload.test.tsx`

Use `@uppy/transloadit` with the Dashboard plugin (or Uppy minimal mode). Server route signs Auth params; client uploads and receives final CDN URL.

**Step 1: Failing tests:** upload widget renders, file selection triggers upload, success populates the field's `value` with CDN URL, preview thumbnail renders.

**Step 2 – 5:** TDD cycle.

**Commit:** `feat(canvas): add Translodit image upload for image_field`

---

### Task 7.9: JSON export/import (TDD)

**Files:**
- Create: `src/components/canvas/JsonIO.tsx`
- Create: `src/components/canvas/__tests__/JsonIO.test.tsx`

**Step 1: Failing tests:**
- Export downloads a `.json` file with the workflow content.
- Import parses uploaded file, validates with `WorkflowExportSchema`, dispatches `importJson` action.
- Malformed import → user-visible error toast, no graph mutation.

**Step 2 – 5:** TDD cycle.

**Commit:** `feat(canvas): add JSON export/import with Zod validation`

---

### Task 7.10: Push Phase 7

```bash
git push origin main
```

---

## Phase 8 — Trigger.dev tasks + orchestrator + Realtime (Tasks 8.1 – 8.10)

### Task 8.1: Trigger.dev project init

**Files:**
- Create: `trigger.config.ts`
- Modify: `package.json` (add Trigger.dev scripts)

Initialize Trigger.dev v4. Configure runtime Node 20 and the `ffmpeg` build extension.

**Manual verification:** `npx trigger.dev@latest dev` connects to your project ref.

**Commit:** `chore(trigger): initialize Trigger.dev v4 with ffmpeg build extension`

---

### Task 8.2: Shared task types

**Files:**
- Create: `src/trigger/types.ts`

Define `NodeOutput`, `CropTaskPayload`, `CropTaskResult`, `GeminiTaskPayload`, `GeminiTaskResult`, `OrchestratorPayload`.

**Commit:** `feat(trigger): add shared task payload and result types`

---

### Task 8.3: cropImageTask with mandatory 30s+ delay (TDD via @trigger.dev/sdk/test)

**Files:**
- Create: `src/trigger/crop-image.ts`
- Create: `src/trigger/__tests__/crop-image.test.ts`

**Step 1: Failing tests:**
- Task awaits ≥30 seconds (assert via real `Date.now()`).
- FFmpeg invocation produces a cropped image at expected dimensions (use a fixture image).
- Output is a Translodit CDN URL.

**Step 2 – 5:** TDD cycle. Use `wait.for({ seconds: 30 })`. Use Trigger.dev's `ffmpeg` binary path to run the crop.

**Commit:** `feat(trigger): add cropImageTask with mandatory 30s delay and ffmpeg crop`

---

### Task 8.4: geminiTask (TDD with stubbed Gemini SDK)

**Files:**
- Create: `src/trigger/gemini.ts`
- Create: `src/trigger/__tests__/gemini.test.ts`

**Step 1: Failing tests:**
- Calls `model.generateContent` with prompt + system instruction.
- Vision images are attached as inline `Part`s.
- Returns `{ kind: "text", text }`.

Mock `@google/generative-ai`.

**Step 2 – 5:** TDD cycle.

**Commit:** `feat(trigger): add geminiTask with vision support`

---

### Task 8.5: Helpers — `markNodeRun`, `fireChildTask`, `computeFinalStatus` (TDD)

**Files:**
- Create: `src/trigger/helpers.ts`
- Create: `src/trigger/__tests__/helpers.test.ts`

**Step 1: Failing tests:**
- `markNodeRun` upserts a NodeRun row with the correct status.
- `fireChildTask` chooses correct child task based on node type and tags it with `nodeId:<id>`, `workflowRunId:<id>`.
- `computeFinalStatus` returns SUCCESS / FAILED / PARTIAL correctly per node states.

**Step 2 – 5:** TDD cycle.

**Commit:** `feat(trigger): add helpers for node-run persistence and final status`

---

### Task 8.6: orchestratorTask wiring `walkDag` + helpers (TDD)

**Files:**
- Create: `src/trigger/orchestrator.ts`
- Create: `src/trigger/__tests__/orchestrator.test.ts`

**Step 1: Failing tests:**
- Loads `WorkflowRun` and `Workflow`, parses graph.
- Resolves Request-Inputs locally (no child task fired).
- Calls `walkDag` with a `fireFn` that wraps `fireChildTask`.
- Resolves Response locally at the end.
- Updates `WorkflowRun.status` to final status.
- A failed child task results in `PARTIAL` status (not `FAILED`) when other nodes succeeded.
- Selective scope correctly skips non-whitelisted nodes.

**Step 2 – 5:** TDD cycle. Use Trigger.dev's testing utilities to invoke the task in isolation; mock `prisma` and child `fireFn`.

**Commit:** `feat(trigger): add orchestratorTask wiring walkDag with full failure semantics`

---

### Task 8.7: API route `POST /api/workflows/[id]/runs` (TDD)

**Files:**
- Create: `src/app/api/workflows/[id]/runs/route.ts`
- Create: `src/app/api/workflows/[id]/runs/__tests__/route.test.ts`

**Step 1: Failing tests:**
- POST validates body (`scope`, `selectedNodeIds`, `inputs`).
- Captures `inputsSnapshot`, creates `WorkflowRun`.
- Calls `tasks.trigger("workflow-run", { workflowRunId })`, persists `triggerRunId`.
- Mints public access token via `auth.createPublicToken`.
- Returns `{ workflowRunId, triggerRunId, publicAccessToken }`.
- Idempotent on idempotency-key header.
- Wrong user → 404.

**Step 2 – 5:** TDD cycle.

**Commit:** `feat(api): add POST /api/workflows/[id]/runs to start orchestrator`

---

### Task 8.8: Wire RunButton + RunMenu to start runs

**Files:**
- Create: `src/components/canvas/RunButton.tsx`
- Create: `src/components/canvas/__tests__/RunButton.test.tsx`

**Step 1: Failing tests:**
- "Run Full" enabled always; clicking calls `runSlice.start("FULL", [])`.
- "Run Selected" enabled only when ≥1 node selected.
- "Run Single" enabled only when exactly 1 node selected.

**Step 2 – 5:** TDD cycle.

**Commit:** `feat(canvas): wire RunButton and RunMenu to run slice`

---

### Task 8.9: Realtime subscription bridge (TDD)

**Files:**
- Create: `src/components/canvas/RealtimeBridge.tsx`
- Create: `src/components/canvas/__tests__/RealtimeBridge.test.tsx`

A small client component that, when an `activeRunId` exists in `run` slice, calls `useRealtimeRunWithSubscribedRuns(triggerRunId, { accessToken })` and pipes every sub-run update into `run.ingestRealtimeUpdate`.

**Step 1: Failing tests:** mock the Realtime hook; assert `ingestRealtimeUpdate` is called with the right shape.

**Step 2 – 5:** TDD cycle.

**Commit:** `feat(canvas): add Realtime bridge from Trigger.dev to run slice`

---

### Task 8.10: End-to-end smoke test of execution + push

**Step 1: Boot dev environment**

```bash
# Terminal 1
npx trigger.dev@latest dev
# Terminal 2
npm run dev
```

**Step 2: Manual verification**

- Open the sample workflow.
- Upload a test image into Request-Inputs `image_field`.
- Click Run Full.
- **Verify:** Crop#1, Crop#2, Gemini#1 all glow simultaneously at T=0.
- **Verify:** Gemini#1 finishes within ~5s; Gemini#2 starts immediately, glowing while Crops are still running their 30s.
- **Verify:** Final Gemini starts only after Crop#1, Crop#2, and Gemini#2 are all done.
- **Verify:** Response node displays the final marketing post.
- **Verify:** History sidebar (placeholder) gets a new entry.

**Step 3: Push**

```bash
git push origin main
```

---

## Phase 9 — History panel, selective execution polish, observability (Tasks 9.1 – 9.7)

### Task 9.1: API routes for history (TDD)

**Files:**
- Create: `src/app/api/workflows/[id]/runs/route.ts` GET handler (extend existing route)
- Create: `src/app/api/runs/[id]/nodes/route.ts`

GET runs ordered desc; GET node-runs for a run.

**Step 1 – 5:** TDD cycle (auth, tenancy, ordering).

**Commit:** `feat(api): add GET endpoints for run history and per-node detail`

---

### Task 9.2: HistoryPanel component (TDD)

**Files:**
- Create: `src/components/history/HistoryPanel.tsx`
- Create: `src/components/history/RunListItem.tsx`
- Create: `src/components/history/ExpandedRunDetail.tsx`
- Create: `src/components/history/__tests__/HistoryPanel.test.tsx`

**Step 1: Failing tests:**
- List renders ordered desc.
- Color-coded badges: green/red/yellow per status.
- Click row → expands → fetches node-runs → renders per-node detail (status, duration, inputs, output, error).
- Expanded view collapses on second click.

**Step 2 – 5:** TDD cycle.

**Commit:** `feat(history): add HistoryPanel with per-run expansion`

---

### Task 9.3: Wire HistoryPanel to history slice + open via toggle

**Files:**
- Modify: `src/app/workflows/[id]/page.tsx`

Right sidebar visible state from `ui` slice; data from `history` slice; refetch on run completion via subscription to `run` slice's status changes.

**Manual verification:** Run the sample workflow → see new run appear in history, expand it, see all 7 node-runs.

**Commit:** `feat(history): wire history panel to canvas with auto-refresh on run completion`

---

### Task 9.4: Selective execution UX polish

**Files:**
- Modify: `src/components/canvas/RunButton.tsx`
- Modify: `src/lib/store/run-slice.ts`

Tooltip explaining why "Run Single" is disabled when nothing/multiple selected. Visual selection feedback (selected nodes get a thicker purple border).

**Manual verification:** select 2 nodes, Run Selected → only those nodes execute, others marked SKIPPED in history.

**Commit:** `feat(canvas): polish selective execution with visual feedback and tooltips`

---

### Task 9.5: Sentry integration

**Files:**
- Create: `sentry.client.config.ts`
- Create: `sentry.server.config.ts`
- Create: `sentry.edge.config.ts`
- Modify: `next.config.ts`

Wrap with `@sentry/nextjs`. DSN from env. Error boundaries on every route surface unhandled errors.

**Commit:** `feat(observability): integrate Sentry for client + server + edge`

---

### Task 9.6: Pino structured server logs

**Files:**
- Create: `src/lib/logger.ts`

Use Pino with pretty in dev, JSON in prod. Use in API routes and server helpers.

**Commit:** `feat(observability): add Pino structured logger`

---

### Task 9.7: Push Phase 9

```bash
git push origin main
```

---

## Phase 10 — Production hardening, E2E, deployment (Tasks 10.1 – 10.10)

### Task 10.1: Error boundaries on every route

**Files:**
- Create: `src/app/error.tsx`
- Create: `src/app/dashboard/error.tsx`
- Create: `src/app/workflows/[id]/error.tsx`
- Create: `src/components/ErrorFallback.tsx`

Each captures error to Sentry, renders a friendly fallback with a "try again" button.

**Commit:** `feat(reliability): add route-level error boundaries`

---

### Task 10.2: Idempotency on POST /api/runs

**Files:**
- Modify: `src/app/api/workflows/[id]/runs/route.ts`

Read `Idempotency-Key` header; cache `(userId, key) → workflowRunId` for 1 hour in a small Postgres table or LRU. Repeat requests return the same run.

Add migration for `IdempotencyRecord` table. Tests cover repeated POSTs.

**Commit:** `feat(api): idempotency keys on run creation to prevent double-fires`

---

### Task 10.3: Optimistic UI for create/rename/delete

**Files:**
- Modify: relevant dialog components

Apply local state change immediately; rollback on error.

**Commit:** `feat(dashboard): optimistic UI with rollback on failure`

---

### Task 10.4: Skeletons matching final layouts

**Files:**
- Create: `src/components/ui/skeletons/*`

Replace bare spinners.

**Commit:** `feat(ui): add layout-matching skeleton loaders`

---

### Task 10.5: Playwright E2E setup

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/auth.spec.ts`
- Create: `e2e/dashboard-crud.spec.ts`
- Create: `e2e/canvas-build.spec.ts`
- Create: `e2e/sample-run.spec.ts`
- Create: `e2e/selective-run.spec.ts`
- Create: `e2e/history.spec.ts`
- Create: `e2e/json-io.spec.ts`
- Create: `e2e/attribution-log.spec.ts`

Configure Playwright to run against a deployed Vercel preview using a dedicated test Clerk instance and a Neon test branch.

**Step 1: Author all E2E specs covering the manual QA checklist.**

**Step 2: Run** `npx playwright install` then `npm run e2e:local` (against `next dev`).

**Step 3: All tests pass.**

**Commit:** `test(e2e): add Playwright suite covering full demo checklist`

---

### Task 10.6: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

Pipeline: install → lint → typecheck → unit + component + integration tests → build → Playwright (against an ephemeral preview deployment). Fail on any step.

**Commit:** `ci: add GitHub Actions pipeline running full test pyramid`

---

### Task 10.7: Bundle analysis + Lighthouse CI

**Files:**
- Modify: `next.config.ts` (`@next/bundle-analyzer` opt-in)
- Create: `.github/workflows/lighthouse.yml` or use Vercel's Lighthouse integration

Set Lighthouse threshold ≥90 across all four categories on the canvas page.

**Commit:** `ci: add bundle analysis and Lighthouse threshold gate`

---

### Task 10.8: Deploy to Vercel + Trigger.dev prod

**Steps:**

1. Create Vercel project linked to the GitHub repo.
2. Set all production environment variables in Vercel dashboard.
3. Run `npx trigger.dev@latest deploy --env prod` to deploy tasks.
4. Run `npx prisma migrate deploy` against production DB.
5. Trigger a Vercel deploy.
6. Smoke-test the live URL: sign up new user, see sample workflow, run it, see live glow + Realtime updates.

**Commit:** `chore(deploy): production deployment configuration`

---

### Task 10.9: README + final polish

**Files:**
- Create: `README.md`

Cover: project overview, tech stack, local setup steps, environment variables, testing commands, deployment notes, demo video link (after Task 10.10).

**Commit:** `docs: add README with full setup and usage`

---

### Task 10.10: Record demo video + final push

**Steps:**

1. Record 3–5 minute demo covering every item in the brief's submission checklist:
   - Auth flow.
   - Dashboard create/open/rename/delete.
   - Building a workflow with all 4 node types.
   - Translodit upload inside Request-Inputs `image_field`.
   - Running the sample workflow end-to-end with visible pulsating glow on every executing node (parallel siblings glowing simultaneously, Crop's 30s delay visible).
   - Single-node + multi-select runs.
   - History panel with all run types + node-level expand.
   - JSON export/import.

2. Upload to Drive (or YouTube unlisted), grab shareable link.
3. Add link to `README.md`.
4. Final commit + push.

```bash
git add README.md
git commit -m "docs: add demo video link"
git push origin main
```

---

## Final acceptance criteria

Before declaring the build done, run through this list (matches design doc §13):

- [ ] All deliverables in the brief's checklist confirmed.
- [ ] Sample workflow runs end-to-end on Vercel with visible pulsating glow.
- [ ] Crop Image's 30-second delay observable.
- [ ] Gemini #2 starts the moment Gemini #1 ends, both Crops still running.
- [ ] Single-node, multi-select, full runs all produce distinct correct history entries.
- [ ] JSON export → import → identical canvas.
- [ ] TypeScript strict passes with zero `any`s.
- [ ] `[NextFlow] Candidate LinkedIn: https://www.linkedin.com/in/harshuldhar` appears exactly once on each page's initial render.
- [ ] All test suites pass in CI (unit + component + integration + Trigger.dev tasks + Playwright E2E).
- [ ] Lighthouse ≥90 across all four categories on the canvas page.
- [ ] Private GitHub repo shared with `bluerocketinfo@gmail.com`.
- [ ] Live Vercel URL.
- [ ] 3–5 minute demo video covering every submission checklist item.

Use the `@superpowers:verification-before-completion` skill to confirm each item with evidence (a passing test run, a screenshot, a video timestamp) before checking it off.

---

## Process notes for the execution session

- **TDD discipline:** every task in Phases 2–9 follows red → green → refactor → commit. UI work uses component tests; pixel-fidelity work uses manual visual verification with side-by-side screenshots.
- **Frequent commits:** every task ends with one commit. Pushes happen at phase boundaries.
- **Sub-skills to invoke:**
  - `@superpowers:test-driven-development` for every TDD-shaped task.
  - `@superpowers:systematic-debugging` whenever a test fails unexpectedly or a manual smoke test breaks.
  - `@superpowers:verification-before-completion` before claiming any task or phase complete.
  - `@superpowers:requesting-code-review` at the end of each phase before pushing to the remote.
- **Task granularity:** if any task balloons beyond ~10 minutes, split it. The plan errs on the side of larger tasks for UI/visual work where tight TDD is less productive; subagents executing those tasks should still take micro-commits within the task and squash if useful.
