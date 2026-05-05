# NextFlow — Design Document

**Date:** 2026-05-05
**Project:** NextFlow — pixel-perfect clone of the Galaxy.ai workflow builder, scoped to LLM workflows.
**Submission target:** `bluerocketinfo@gmail.com` (private GitHub repo + Vercel URL + 3–5 min demo video).
**Candidate LinkedIn (mandatory attribution log):** `https://www.linkedin.com/in/harshuldhar`

---

## 1. Problem statement

Build a production-ready, pixel-perfect clone of `try.galaxy.ai/clone`, focused on LLM workflows only. The user signs in via Clerk, lands on a dashboard listing their workflows, opens one to edit on a React Flow canvas, and runs it. Every executable node (Crop Image, Gemini 3.1 Pro) executes as a Trigger.dev v4 task. Independent tasks fire concurrently; the canvas glows live as nodes execute, with each finished node fanning out to dependents *immediately* and never blocking on unrelated siblings.

Three pages exist and only three: Clerk sign-in/up, dashboard, workflow canvas. There is no marketing surface. Unauthenticated traffic redirects to Clerk.

## 2. Locked stack

Next.js (App Router) · TypeScript strict · PostgreSQL on Neon · Prisma · Clerk · React Flow · Trigger.dev v4 · Transloadit · FFmpeg via Trigger.dev · Tailwind · Zustand · Zod · `@google/generative-ai` · Lucide React.

Trigger.dev v4 specifically (not v3 — v3 sunsets July 1, 2026).

## 3. Locked architectural decisions

| Decision | Choice | Why |
|---|---|---|
| Realtime model | **Trigger.dev Realtime SDK** | Native; no SSE plumbing; idiomatic. |
| Orchestration topology | **Single root orchestrator task per run** | Server-authoritative, history-correct, browser-refresh-safe, single Realtime subscription, all three execution scopes via one code path. |
| LLM output rendering | **Complete-then-paint** | Brief never asks for token streaming; pulsating glow already conveys liveness; avoids fragile metadata-streaming machinery. |
| Client state | **Zustand single store, four slices** (`graph` / `run` / `history` / `ui`) | Mandated stack; clean separation of saved-vs-transient state; undo/redo trivially scoped to graph slice. |

## 4. System architecture

Three trust boundaries:

```
BROWSER (Next.js client + Zustand store + Realtime subscription)
   ↓ HTTPS, Clerk-authed
NEXT.JS APP ROUTER on Vercel (App Router routes + API + Prisma)
   ↓ Trigger.dev SDK
TRIGGER.DEV v4 RUNTIME (orchestratorTask, cropImageTask, geminiTask)
```

The browser owns transient state and visualization. Vercel owns auth, CRUD, and the trigger of orchestrator runs. Trigger.dev owns the entire execution plane and writes node-run results back to Postgres.

### 4.1 Folder layout

```
nextflow/
├── prisma/schema.prisma
├── src/
│   ├── app/
│   │   ├── (auth)/sign-in/[[...sign-in]]/page.tsx
│   │   ├── (auth)/sign-up/[[...sign-up]]/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── workflows/[id]/page.tsx
│   │   ├── api/
│   │   │   ├── workflows/route.ts
│   │   │   ├── workflows/[id]/route.ts
│   │   │   ├── workflows/[id]/runs/route.ts
│   │   │   └── transloadit/sign/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── canvas/
│   │   ├── dashboard/
│   │   ├── history/
│   │   └── ui/
│   ├── lib/
│   │   ├── store/
│   │   ├── dag/
│   │   ├── prisma.ts
│   │   ├── clerk.ts
│   │   ├── transloadit.ts
│   │   └── schemas/
│   └── trigger/
│       ├── orchestrator.ts
│       ├── crop-image.ts
│       ├── gemini.ts
│       └── types.ts
├── trigger.config.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── .env.local.example
└── README.md
```

`src/lib/dag` and `src/lib/schemas` are shared between client (drag rejection, form validation) and server (orchestrator wave-walker, request validation).

`AttributionLog` mounted in `app/layout.tsx` fires exactly once per route navigation with the format `[NextFlow] Candidate LinkedIn: https://www.linkedin.com/in/harshuldhar`.

## 5. Data model (Prisma)

Three tables: `Workflow`, `WorkflowRun`, `NodeRun`. Workflow content is stored as JSON inside `Workflow.graph` to mirror React Flow's data shape and make export/import a single-field copy. Per-user tenancy via `clerkUserId` on every row.

```prisma
enum RunStatus { PENDING RUNNING SUCCESS FAILED PARTIAL CANCELLED }
enum RunScope { FULL PARTIAL SINGLE }
enum NodeStatus { PENDING RUNNING SUCCESS FAILED SKIPPED }

model Workflow {
  id        String        @id @default(cuid())
  userId    String
  name      String
  graph     Json
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  runs      WorkflowRun[]
  @@index([userId, updatedAt(sort: Desc)])
}

model WorkflowRun {
  id              String    @id @default(cuid())
  workflowId      String
  workflow        Workflow  @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  userId          String
  scope           RunScope
  selectedNodeIds String[]
  status          RunStatus @default(PENDING)
  triggerRunId    String?
  inputsSnapshot  Json
  startedAt       DateTime  @default(now())
  finishedAt      DateTime?
  durationMs      Int?
  errorMessage    String?
  nodeRuns        NodeRun[]
  @@index([workflowId, startedAt(sort: Desc)])
  @@index([userId])
}

model NodeRun {
  id            String      @id @default(cuid())
  workflowRunId String
  workflowRun   WorkflowRun @relation(fields: [workflowRunId], references: [id], onDelete: Cascade)
  nodeId        String
  nodeType      String
  status        NodeStatus  @default(PENDING)
  inputs        Json?
  output        Json?
  errorMessage  String?
  startedAt     DateTime?
  finishedAt    DateTime?
  durationMs    Int?
  triggerRunId  String?
  @@index([workflowRunId])
  @@unique([workflowRunId, nodeId])
}
```

### 5.1 Why these specific shapes

- **`Workflow.graph` as JSON, not normalized.** No SQL queries reach into individual node config; storing as JSON saves three tables, makes export/import a single-field operation, and matches React Flow's wire format directly.
- **`WorkflowRun.inputsSnapshot`.** Captured at run-start. Without it, "show me what this run was given" is unreconstructable after the workflow is edited.
- **`WorkflowRun.triggerRunId`.** Lets the browser re-subscribe to a still-running run after a refresh.
- **`NodeRun.triggerRunId`.** Per-node child Trigger.dev run ID, for deep-link to dashboard and per-node retry.
- **`NodeRun.nodeId` denormalized from JSON graph.** History remains readable even if the user later deletes that node from the workflow.
- **`@@unique([workflowRunId, nodeId])`.** DB-enforced — no double-write on retries.
- **`PARTIAL` enum value.** Required for the brief's yellow-badge case (selective run with partial failure).

### 5.2 Sample workflow seeding

No Prisma seed scripts. The pre-built sample workflow is created on first sign-in per user via an idempotent `upsert` keyed on `(userId, name="Trial Task Workflow")`, run from the dashboard route's loader. Vercel-safe; works for users who sign up at runtime.

## 6. Execution engine

The brief's hardest invariants:

1. Independent tasks fire concurrently.
2. A finished node fans out to its dependents *immediately* — never blocks on unrelated siblings.
3. 30+ second mandatory delay on every Crop Image task.
4. Selective execution (full / multi-select / single-node) all produce history entries.
5. Pulsating glow on every executing node; parallel siblings glow simultaneously.

### 6.1 Wave-walker, not topological levels

A naive topo-level walker would group nodes by depth and fire each level after the previous level fully completes. That violates invariant #2 (Gemini #2 would wait on the slow Crops just because they're at the same depth). Instead, the orchestrator runs a **ready-set loop**:

```
ready := { nodes whose direct upstreams are all done }
while in-flight is non-empty:
    fire all of ready concurrently
    await Promise.race over in-flight   ← any single sibling settling wakes us up
    move settled promises out of in-flight
    fire newly-ready nodes IMMEDIATELY (next iteration)
```

This guarantees Gemini #2 fires the moment Gemini #1 finishes, even while both Crops are still mid-30s-await. Final Gemini joins on Crop#1 + Crop#2 + Gemini#2 explicitly via the ready-set check.

### 6.2 Orchestrator task (sketch)

```ts
// src/trigger/orchestrator.ts (simplified)
export const orchestratorTask = task({
  id: "workflow-run",
  run: async (payload: { workflowRunId: string }) => {
    const run = await db.workflowRun.findUniqueOrThrow({ where: { id: payload.workflowRunId }});
    const workflow = await db.workflow.findUniqueOrThrow({ where: { id: run.workflowId }});
    const graph = parseGraph(workflow.graph);
    const whitelist = run.scope === "FULL" ? null : new Set(run.selectedNodeIds);

    const outputs: Record<string, NodeOutput> = {};
    outputs[REQUEST_INPUTS_NODE_ID] = run.inputsSnapshot;
    await markNodeRun(payload.workflowRunId, REQUEST_INPUTS_NODE_ID, "SUCCESS", { output: run.inputsSnapshot });

    const nodeStates = initStates(graph, whitelist);
    const inFlight = new Map<string, Promise<NodeResult>>();

    const computeReady = () => graph.nodes.filter(n =>
      nodeStates.get(n.id) === "pending" &&
      n.type !== "response" &&
      graph.edges.filter(e => e.target === n.id).every(e => nodeStates.get(e.source) === "done")
    );

    const dispatch = (nodeIds: string[]) => {
      for (const id of nodeIds) {
        const node = graph.nodes.find(n => n.id === id)!;
        nodeStates.set(id, "running");
        const inputs = resolveInputsFor(node, graph, outputs);
        const promise = fireChildTask(node, inputs, payload.workflowRunId, run.triggerRunId)
          .then(async result => { outputs[id] = result.output; await markNodeRun(payload.workflowRunId, id, "SUCCESS", result); nodeStates.set(id, "done"); return result; })
          .catch(async err => { await markNodeRun(payload.workflowRunId, id, "FAILED", { errorMessage: String(err) }); nodeStates.set(id, "done"); throw err; });
        inFlight.set(id, promise);
      }
    };

    dispatch(computeReady());
    while (inFlight.size > 0) {
      await Promise.race([...inFlight.values()].map(p => p.catch(() => {})));
      for (const [id, p] of inFlight) if (await isSettled(p)) inFlight.delete(id);
      dispatch(computeReady());
    }

    const responseInput = resolveResponseInput(graph, outputs);
    await markNodeRun(payload.workflowRunId, RESPONSE_NODE_ID, "SUCCESS", { output: responseInput });
    await db.workflowRun.update({ where: { id: payload.workflowRunId }, data: { status: computeFinalStatus(nodeStates, run.scope), finishedAt: new Date(), durationMs: ... }});
  },
});
```

The two key implementation choices:

- Children fired with `node.trigger()` (not `triggerAndWait`) so the orchestrator holds raw run-handles and controls await topology.
- `Promise.race` over `inFlight` followed by an immediate `dispatch(computeReady())` is the loop invariant that satisfies "fan out immediately."

### 6.3 Child tasks

**`cropImageTask`** — `await wait.for({ seconds: 30 })` first (mandatory), then FFmpeg crop via Trigger.dev's `ffmpeg` build extension. Output stored on Transloadit for stable CDN URLs.

**`geminiTask`** — `GoogleGenerativeAI` from `@google/generative-ai`, `model.generateContent(parts)` (complete, not streaming), returns `{ kind: "text", text }`. Vision images attached as inline `Part`s.

Both tasks: `retry: { maxAttempts: 2 }` for transient errors. Tags include `nodeId:<id>` and `workflowRunId:<id>` so the browser's Realtime subscription can route updates.

### 6.4 Realtime: server → browser

`POST /api/runs` creates a `WorkflowRun`, calls `tasks.trigger("workflow-run", { workflowRunId })`, saves the returned `triggerRunId`, mints a public access token scoped to that run via `auth.createPublicToken({ scopes: { read: { runs: [triggerRunId] }}})`, and returns `{ triggerRunId, publicAccessToken }` to the browser.

The browser uses Trigger.dev's `useRealtimeRunWithSubscribedRuns(triggerRunId, { accessToken })` hook, which streams updates for the orchestrator and all its child runs. Each sub-run's `tags` carry the `nodeId`; the browser maps updates into the Zustand `run` slice, which drives glow and inline output rendering.

When a sub-run flips to COMPLETED, the browser fetches `/api/node-runs/:id` for the full output and writes it into the Gemini node body (or shows the cropped image preview on the Crop node).

### 6.5 Selective execution

Same orchestrator, parameterized via `scope` + `selectedNodeIds`:
- **FULL:** no whitelist; all nodes.
- **PARTIAL (multi-select):** whitelist; non-whitelisted nodes marked SKIPPED.
- **SINGLE:** whitelist of size 1; same code path. Upstream values come from the most recent successful run's cached outputs; if missing, the run fails fast with a clear error.

### 6.6 Failure semantics

- Child task throws → `NodeRun.status = FAILED`.
- Downstream nodes whose upstream failed → `SKIPPED` (reason: "upstream failed").
- Final status: `SUCCESS` (all whitelisted succeeded) / `FAILED` (all failed) / `PARTIAL` (otherwise).
- Orchestrator never throws; always writes a final status. History is always readable.

### 6.7 Risk register

| Risk | Mitigation |
|---|---|
| Orchestrator crashes mid-run | Trigger.dev v4 retries the orchestrator. State lives in Postgres, not memory; resumable. |
| Browser refresh during run | Page-load fetches latest `WorkflowRun`; if RUNNING, re-subscribe by `triggerRunId`. |
| Two users open same workflow | Both subscribe to the same `triggerRunId`. Edits are last-write-wins. Real-time collaborative editing is out of scope. |
| Gemini 429 / rate-limit | Trigger.dev retry config handles transient 429s; persistent rate-limits surface as a clean FAILED node. |
| Transloadit signed URL expiry | Outputs stored via Transloadit's "store" step, served via Transloadit Smart CDN (`<workspace>.tlcdn.com`) URLs. No expiry concern. |
| User edits workflow during a run | Orchestrator already loaded `Workflow.graph` at run-start; works off the snapshot. Subsequent edits don't affect the in-flight run. |

## 7. Client state (Zustand)

Single store, four orthogonal slices using `immer` middleware so mutations are natural without breaking React Flow reference equality.

### 7.1 `graph` slice (saved state, synced to Postgres)

Holds `workflowId`, `name`, `nodes`, `edges`, `isDirty`, `lastSavedAt`. Actions: `setNodes`, `setEdges`, `addNode`, `removeNodes` (refuses Request-Inputs and Response), `connect` (type-checks and cycle-checks before accepting), `updateNodeConfig`, `rename`, `hydrate`, `save` (debounced, 1s after last edit), `importJson` (Zod-validated), `exportJson`.

**Type-safe connection rule:** `connect()` calls `lib/dag/canConnect(sourceHandle, targetHandle, currentEdges)` which checks both handle compatibility and acyclicity. False → React Flow rejects the drag visually.

**Greying out connected manual fields:** node renderers read `state.graph.edges` to check whether each input handle is connected; if yes, the corresponding manual entry is disabled with a tooltip "Connected to [upstream-node-name]."

### 7.2 `run` slice (transient, from Realtime)

Holds `activeRunId`, `triggerRunId`, `publicAccessToken`, `scope`, `status`, `startedAt`, `nodes: Record<nodeId, NodeRunState>`. Actions: `start(scope, selectedNodeIds)`, `ingestRealtimeUpdate(update)`, `reset()`.

**Critical invariant:** never persisted to Postgres; cleared on completion or navigation. Server writes are owned by the orchestrator only.

### 7.3 `history` slice (lazy-loaded past runs)

Holds `runs: WorkflowRunSummary[]`, `expandedRunId`, `expandedNodeRuns`. Actions: `fetch()`, `expand(runId)` (single round-trip), `collapse()`. Optimistic insert of new RUNNING entry when `run.start()` is called.

### 7.4 `ui` slice (selection, picker, sidebar, undo/redo)

Holds `selectedNodeIds`, `isPickerOpen`, `pickerSearch`, `isHistorySidebarOpen`, `isLeftSidebarOpen`, `past[]`, `future[]`. Actions: `undo`, `redo`, `pushSnapshot`.

Undo/redo is **graph-only** (you can't undo a run). Snapshots capped at 50 entries. Pushed by `addNode`, `removeNodes`, `connect`, `updateNodeConfig` — not by `setNodes`/`setEdges` (those fire constantly during drag).

Keyboard: `Cmd/Ctrl+Z` undo, `Cmd/Ctrl+Shift+Z` redo, `Delete`/`Backspace` deletes selected (Request-Inputs and Response filtered out).

## 8. UI component map

### 8.1 `/sign-in` and `/sign-up`
Plain Clerk `<SignIn />` / `<SignUp />` centered on a clean background, themed via Tailwind to match Galaxy.ai's palette.

### 8.2 `/dashboard`
Left sidebar (logo + nav items + UserButton) + main area with header ("Workflows" + "Create New Workflow" CTA) + grid of `WorkflowCard`s (each: name, last-edited timestamp, in-progress badge if running, kebab menu with Open/Rename/Delete) or `EmptyState`. Dialogs for Create / Rename / Delete. Card "in-progress" badges driven by light polling (`/api/workflows?withRunStatus=1`, every 5s while page open) — cheaper than per-card Realtime.

### 8.3 `/workflows/[id]`

```
TopBar         (back, name, run-stats pills, Run button + menu, history toggle)
Canvas         (React Flow; Background dots, MiniMap bottom-right, Controls bottom-left)
  ├── AnimatedPurpleEdge custom edge type
  ├── Four custom node renderers
  └── BottomToolbar (undo/redo/fit/zoom + center PlusButton + JSON in/out)
RightSidebar   (HistoryPanel; per-run rows expand to per-node detail)
NodePickerModal (search + tabs: Recent · Image · Video · Audio · Others)
AttributionLog (one-shot useEffect)
```

### 8.4 Node renderers

Shared base shell handles:
- **Pulsating glow** when `state.run.nodes[nodeId].status === 'RUNNING'` via a CSS keyframe on `::before`. Each instance owns its own animation — parallel siblings glow simultaneously without JS coordination.
- **Status indicator** (top-right dot): grey/purple-pulse/green/red.
- **Node-type icon** (Lucide React).
- **Delete button** in kebab menu, hidden for Request-Inputs and Response.

**RequestInputsNode:** dynamic field list. Each field row: name input, type indicator, output handle on right, manual entry (textarea or Transloadit upload widget). "Add field" popover with type selector.

**CropImageNode:** Input Image handle (required) + manual X/Y/W/H percentage inputs (default 0/0/100/100). Manual fields grey out when corresponding input is connected. Output Image handle.

**GeminiNode:** model selector in header. Input handles: Prompt (required), System Prompt, Image (Vision), Video, Audio, File, each with corresponding manual entry that greys out on connect. Body bottom: Output Response section with markdown-rendered Gemini text. Collapsed Settings section (visual parity).

**ResponseNode:** single `result` input handle. Renders final captured value. No output handle, no delete.

### 8.5 NodePicker

Tabs: Recent · Image · Video · Audio · Others. Functional cards: **Crop Image** (Image tab), **Gemini 3.1 Pro** (Others/LLMs tab). Disabled placeholder cards for visual parity (greyed out, "Coming soon").

### 8.6 Visual parity decisions

- Tailwind theme: Galaxy.ai's purple (~`#7C3AED`; exact value sampled during build).
- Lucide React for all icons.
- Animated purple edges: SVG `<path stroke-dasharray="6 4">` with CSS `stroke-dashoffset` animation (marching ants).
- Dot-grid background: React Flow `<Background variant={Dots} gap={24} />`, soft grey dots.
- MiniMap bottom-right, ~150×100px, custom node-color function.

### 8.7 Out of scope

Marketing/landing/pricing pages (forbidden by brief) · functional Settings page · node types beyond the 4 mandated · token-by-token Gemini streaming · real-time multi-user collaboration · folders/tags · sharing beyond per-user ownership.

## 9. Setup, deployment, build sequence

### 9.1 External accounts (do first)

1. Neon — `DATABASE_URL` (pooled) + `DIRECT_URL` (for migrations).
2. Clerk — application with email + Google providers; publishable + secret keys.
3. Google AI Studio — `GOOGLE_AI_API_KEY`.
4. Transloadit — workspace + Auth Key/Secret + two Templates (upload + crop).
5. Trigger.dev v4 — project + secret key + project ref.
6. Vercel — project linked to GitHub repo (last, day 3).

### 9.2 Environment variables

`.env.local.example` committed with empty values:

```
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
GOOGLE_AI_API_KEY=
TRANSLOADIT_AUTH_KEY=
TRANSLOADIT_AUTH_SECRET=
TRANSLOADIT_TEMPLATE_UPLOAD=
TRANSLOADIT_TEMPLATE_CROP=
TRIGGER_SECRET_KEY=
TRIGGER_PROJECT_REF=
```

LinkedIn URL is hardcoded in `AttributionLog`, not env-driven.

### 9.3 Trigger.dev configuration

`trigger.config.ts` declares project ref, runtime Node 20, and the `ffmpeg` build extension (bundles a static FFmpeg binary into the deploy image — required for Crop tasks).

### 9.4 Vercel deployment

- Build command: `prisma generate && next build`.
- Trigger.dev tasks deploy *separately* via `npx trigger.dev@latest deploy --env prod`.
- Migrations run via `prisma migrate deploy` before each deploy.

### 9.5 Build sequence

**Day 1 — Foundation**
1. Scaffold Next.js 15 + TS strict + Tailwind + ESLint.
2. Install locked-stack deps; lock versions in `package.json`.
3. Prisma + Neon + initial migration.
4. Clerk + middleware. Sign-in/up pages. Unauthenticated redirects.
5. Dashboard with workflow CRUD API routes (Zod-validated). Create/Rename/Delete dialogs. Empty state.
6. `AttributionLog` in `app/layout.tsx`.

**Day 2 — Canvas + execution**
7. React Flow with four node renderers (visual-only first).
8. `lib/dag/`: type-check, cycle detection, ready-set, topo helpers.
9. Zustand store with `graph` and `ui` slices wired to React Flow events.
10. Bottom `+` picker, top bar, right history sidebar shell.
11. Trigger.dev v4 project + `cropImageTask` (with 30s+ delay) + `geminiTask`.
12. `orchestratorTask` with the wave-walker.
13. `POST /api/runs` to start orchestrator, return `{ triggerRunId, publicAccessToken }`.
14. Realtime subscription in workflow page → `run` slice.
15. Pulsating glow + per-node output rendering.

**Day 3 — Polish**
16. Selective execution (single-node, multi-select).
17. History panel with node-level expand.
18. JSON export/import (Zod-validated import).
19. Transloadit upload widget for `image_field`.
20. Sample workflow seeding helper.
21. Visual-parity polish pass against `try.galaxy.ai/clone`.
22. Vercel + Trigger.dev deploy. Smoke-test on prod.
23. Demo video.

**Days 4–7 — Production hardening**
24. Test suite (see Section 10).
25. CI gates, Lighthouse pass.
26. Error-boundary hardening, observability wiring.
27. Final manual QA pass.

## 10. Testing & quality

### 10.1 Test pyramid

**Unit (Vitest + happy-dom):**
- `lib/dag/`: type-compatibility, cycle detection, topological ordering, ready-set computation, response-input resolution. Property-based tests via `fast-check` for cycle detector and wave-walker.
- `lib/schemas/`: every Zod schema with accept/reject test cases including JSON export/import round-trip.
- Zustand slices isolated: graph mutations, undo/redo correctness, run-state ingestion from synthetic Realtime events, history list management.
- Orchestrator wave-walker as pure function `walkDag(graph, whitelist, fireFn)` with mocked `fireFn`. Assertions:
  - Independent siblings fire concurrently.
  - A node fires the moment *its* upstream resolves, even when a sibling's upstream is still pending.
  - Diamond joins wait for *all* upstreams.
  - Whitelist correctly skips non-selected nodes.
  - Failed upstream → downstream marked SKIPPED.
  - Final status SUCCESS/FAILED/PARTIAL computed correctly.

**Component (Vitest + React Testing Library):**
- Each node renderer: handles, manual-field grey-out on connect, status indicator, glow class application.
- NodePicker: tabs, search, only-functional-cards-clickable.
- HistoryPanel: list rendering, expand/collapse, badge colors.
- RunButton + RunMenu: enabled/disabled states by `selectedNodeIds`.
- Transloadit upload: file → progress → preview → URL piped to `image_field`.

**API integration (Vitest + Neon test branch):**
- Every API route: unauthenticated (401), wrong-user (404 — never leak existence), valid (happy path), Zod-invalid (400 with field-level errors).
- Workflow CRUD round-trip.
- Run creation snapshots inputs.
- History fetch ordering and pagination.
- JSON import rejects malformed payloads.

**Trigger.dev tasks (`@trigger.dev/sdk/test`):**
- `cropImageTask` against a known image; verify output dimensions and that 30s+ actually elapsed.
- `geminiTask` with stubbed `GoogleGenerativeAI` returning fixture responses (fast, no external calls in CI).

**End-to-end (Playwright):**
- Auth flow redirect + sign-in.
- Dashboard CRUD round-trip.
- Canvas build: blank → add Crop via picker → connect → verify edge appears, manual field greys out.
- Sample workflow execution: glow appears on Crop#1, Crop#2, Gemini#1 simultaneously at T=0; Gemini #2 starts within ~10s of Gemini #1's completion (well before either Crop's 30s finishes); run completes SUCCESS; history entry persisted with correct per-node durations.
- Selective: Run Selected only runs whitelisted nodes.
- History expand: per-node detail renders.
- JSON export → import: canvas matches.
- Attribution log: exactly one `[NextFlow] Candidate LinkedIn: …` line per page navigation.

E2E run against deployed Vercel previews using a dedicated test Clerk instance and Neon test branch.

### 10.2 Quality gates (CI-enforced)

- `tsc --noEmit` strict; no `any` (`@typescript-eslint/no-explicit-any: error`); no implicit returns; no unused locals.
- ESLint Next.js recommended + react-hooks rules as errors. Zero warnings.
- Prettier via Husky + lint-staged.
- `type-coverage` ≥ 99%.
- Bundle size monitored.
- Lighthouse ≥ 90 across Performance / Accessibility / Best Practices / SEO. A11y violations fail CI.

### 10.3 Reliability hardening

- Error boundaries on every route with clean fallback UI.
- Retry logic on every fetch (exp backoff, 3 attempts on 5xx).
- Idempotency keys on `POST /api/runs` to prevent double-click double-runs.
- Optimistic UI with rollback on failure for create/rename/delete.
- Skeletons matching final layouts (no bare spinners).
- Server logging via `pino`; client errors to Sentry.
- DB constraints belt-and-braces with API validation.
- Reversible migrations.

### 10.4 Manual QA checklist

Pre-deploy:
- All deliverables in the brief checklist.
- Sample workflow renders identical to reference at multiple zoom levels and viewports.
- Pulsating glow on every executing node, parallel siblings simultaneous.
- 30s+ Crop delay confirmed via stopwatch.
- Request-Inputs and Response refuse delete via menu and Delete/Backspace.
- Type-safe drag rejection: image-output → text-only Prompt input is rejected.
- Cycle prevention: Final Gemini → Gemini #1 prompt is rejected.
- Undo/redo across ≥10 ops.
- JSON export → import → identical canvas.
- Console: exactly one `[NextFlow]` line per route navigation.
- ≥1024px viewport renders cleanly; below 1024px shows "use desktop" notice.

## 11. Mandatory attribution log

Format **exactly**: `[NextFlow] Candidate LinkedIn: https://www.linkedin.com/in/harshuldhar`

Implemented as `<AttributionLog />` client component mounted in `app/layout.tsx`. Uses a route-keyed `useEffect` (depends on `usePathname()`) so it fires once on initial mount of each route navigation. Hardcoded URL — no env var.

## 12. Out of scope

- Marketing / landing / pricing pages.
- Functional Settings page.
- Node types beyond Request-Inputs, Crop Image, Gemini 3.1 Pro, Response.
- Token-by-token Gemini streaming.
- Real-time multi-user collaborative editing.
- Workflow folders / tags.
- Sharing beyond per-user ownership.
- Mobile canvas below 1024px (notice shown instead).
- Internationalization.

## 13. Definition of done

- All deliverables in the brief's checklist confirmed.
- Sample workflow runs end-to-end on Vercel with visible pulsating glow on every executing node.
- Crop Image's 30-second delay observable.
- Gemini #2 starts the moment Gemini #1 ends, while both Crops are still running (visible in demo video).
- Single-node, multi-select, and full runs each produce distinct correct history entries.
- JSON export of sample workflow → re-import → identical canvas.
- TypeScript strict mode passes with zero `any`s in our code.
- `[NextFlow] Candidate LinkedIn: https://www.linkedin.com/in/harshuldhar` appears exactly once on each page's initial render.
- All test suites pass in CI.
- Lighthouse scores ≥ 90 across all four categories on the canvas page.
- Private GitHub repo shared with `bluerocketinfo@gmail.com`.
- Live Vercel URL.
- 3–5 minute demo video covering: auth flow, dashboard CRUD, building a workflow with all 4 node types, Transloadit upload inside `image_field`, full sample workflow run with visible glow, single-node + multi-select runs, history panel with node-level expand, JSON export/import.
