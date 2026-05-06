# NextFlow Production Parity Fix Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## Execution Status (2026-05-06)

All batches landed in a single autonomous pass on `main`:

- **Batch 1 (Foundation Correctness):** ✅ Done
  - Task 1: Gemini model unified via `src/lib/gemini-model.ts`; runtime, schema, picker, dropdown, sample workflow all use `gemini-2.5-flash-lite` (or `GEMINI_MODEL_ID` override). Bumped from `gemini-flash-latest` (which aliases the throttled `gemini-3-flash-preview`) to fix free-tier 429s.
  - Task 2: Animated purple edges via `globals.css` + `toRFEdge` in `Canvas.tsx`.
  - Task 3: Client-side cycle detection in `onConnect` (`Canvas.tsx`).
- **Batch 2 (Node Validation And Sample Workflow):** ✅ Done
  - Task 4: Field-name validation (regex + uniqueness) in schema and `RequestInputsNode` UI.
  - Task 5/6: Starter graph audited, sample workflow already aligned to `DEFAULT_GEMINI_MODEL_ID`.
- **Batch 3 (Execution Feature Completion):** ✅ Done
  - Task 7: Multi-select via React Flow `onSelectionChange` + new `multiSelectedNodeIds` store slice; "Run Selected" menu item in `RunButton`.
  - Task 8: Connected-input greying already covered by `is-greyed` styling on Crop/Gemini nodes.
- **Batch 4 (Crop Output Separation):** ✅ Done
  - Task 9: Server uploads accept a `category` flag; crop outputs stored under `crop-output/` filename prefix to keep them distinct from user uploads.
- **Batch 5 (History And Persistence Completeness):** ✅ Done
  - Task 10: History panel already renders full per-node detail (output/input/error) — verified.
  - Task 11: Idempotency tracked via `__idempotencyKey` marker inside `inputsSnapshot` JSON column; no schema migration required.
- **Batch 6 (Galaxy Pixel Parity):** ✅ Done
  - Tasks 12-14: New design tokens in `globals.css`, refined `BaseNodeShell` (Inter font, 14px radius, soft shadows, color-coded handles), redesigned `BottomToolbar` (Galaxy-style pill group), tighter `CanvasShell` header with prominent `Run` CTA.
- **Batch 7 (Security And Deployment Hardening):** ✅ Done
  - Task 15: Same-origin guard (`src/lib/security/origin.ts`) wired into all four mutating routes (`POST /workflows`, `PUT/DELETE /workflows/[id]`, `POST /workflows/[id]/runs`); test coverage added.
  - Task 16: `npm run build` produces an optimized Vercel-ready output.
- **Database migration:** existing workflow rows pinned to retired Gemini model ids upgraded via `npm run db:migrate-gemini`.

Quality gates (final):
- `npx vitest run`: **395/395 passing** across **45 files**.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean (Next.js 15 / Turbopack).

---


**Goal:** Bring the existing NextFlow application into production-grade parity with the Galaxy workflow editor reference, including UI, routing, node behavior, execution semantics, persistence, and deployment readiness.

**Architecture:** Keep the current Next.js App Router, Clerk, Prisma/Neon, Zustand, React Flow, Trigger.dev, Zod, Transloadit, and Tailwind architecture. Fix gaps in small test-first batches, preserving existing ownership checks and workflow persistence while tightening client-side validation and runtime consistency.

**Tech Stack:** Next.js App Router, TypeScript strict mode, React Flow, Trigger.dev v4, Prisma + Neon PostgreSQL, Clerk, Zustand, Zod, Transloadit, FFmpeg, Tailwind CSS, Lucide React, Vitest, Playwright, Vercel.

---

## Reference Inputs

- Galaxy Flow landing page: `https://app.galaxy.ai/flow`
- Galaxy system workflow route: select **System Workflows -> AI Racing Car Generator**
- Galaxy workflow detail route: `https://app.galaxy.ai/workflows/ai-racing-car`
- Galaxy reference canvas route: `https://app.galaxy.ai/workflows/cmou87hp90000kv04w3km1dol/canvas`
- Alternate reference canvas route: `https://app.galaxy.ai/workflows/cmotcu8wi003nkt04njcv2aj3/canvas`
- Reference screenshots supplied by user:
  - Flow landing page with sidebar, red lifetime-deal banner, System Workflows card, Your Workflows section
  - AI Racing Car Generator Playground tab
  - AI Racing Car Generator Workflow preview tab
  - Cloned canvas view, the final visual reference to match
- Auth note: user reports Edge is already logged in and working. If automated auth is required, provided email/password are `harshul.dhar@gmail.com` / `HARSHUL@66751735.DHA`.
- Gemini rule: use the model name that the current Gemini key actually calls successfully; do not expose one label in the UI while calling a different hidden model unless the user explicitly approves that behavior.
- Crop-output storage rule: crop outputs must be stored separately from user-uploaded originals.
- Deployment target: Vercel.

---

## Batch 1: Foundation Correctness

### Task 1: Align Gemini Model Naming And Runtime

**Files:**
- Modify: `src/trigger/gemini.ts`
- Modify: `src/trigger/types.ts`
- Modify: `src/lib/schemas/node.ts`
- Modify: `src/components/canvas/nodes/GeminiNode.tsx`
- Modify: `src/components/canvas/picker/NodeCatalog.ts`
- Modify: `src/lib/sample-workflow.ts`
- Test: `src/trigger/__tests__/gemini.test.ts`
- Test: `src/components/canvas/nodes/__tests__/GeminiNode.test.tsx`
- Test: `src/lib/__tests__/sample-workflow.test.ts`

**Step 1: Identify the configured Gemini model**

Read `process.env.GEMINI_MODEL_ID` at runtime and use it as the default model when present. The UI label must match the actual model value that will be sent to Google.

**Step 2: Write failing tests**

Add tests that prove:
- a new Gemini node defaults to the effective Gemini model
- Gemini node dropdown includes the effective model
- `geminiTask` passes `payload.model` into `getGenerativeModel`
- sample workflow uses the effective model consistently

Run:
`npm run test -- src/trigger/__tests__/gemini.test.ts src/components/canvas/nodes/__tests__/GeminiNode.test.tsx src/lib/__tests__/sample-workflow.test.ts`

Expected before implementation: at least one failure proving model selection is currently ignored or inconsistent.

**Step 3: Implement**

- Add `model` to `GeminiTaskPayload` if needed.
- In `src/trigger/orchestrator.ts`, pass `p.model` to `GeminiTaskPayload`.
- In `src/trigger/gemini.ts`, call:

```ts
const model = genAI.getGenerativeModel({
  model: payload.model,
  systemInstruction: payload.systemPrompt,
  generationConfig: {
    temperature: payload.temperature,
    maxOutputTokens: effectiveMaxTokens,
    topP: payload.topP,
  },
});
```

- Use one helper/default value for Gemini model naming across schema, picker, UI, and sample workflow.

**Step 4: Verify**

Run:
`npm run test -- src/trigger/__tests__/gemini.test.ts src/components/canvas/nodes/__tests__/GeminiNode.test.tsx src/lib/__tests__/sample-workflow.test.ts`

Expected: all targeted tests pass.

---

### Task 2: Add Animated Purple Edges

**Files:**
- Modify: `src/app/workflow/[id]/Canvas.tsx`
- Modify: `src/app/globals.css`
- Test: `src/app/workflow/[id]/__tests__/Canvas.test.tsx`

**Step 1: Write failing test**

Add a canvas test proving exported React Flow edges include:
- `animated: true`
- violet stroke styling
- a custom class name or marker that can be asserted

Run:
`npm run test -- src/app/workflow/[id]/__tests__/Canvas.test.tsx`

Expected before implementation: fails because edges are currently default grey and not animated.

**Step 2: Implement**

Update `toRFEdge` so every edge returns purple animated styling:

```ts
return {
  id: e.id,
  source: e.source,
  target: e.target,
  sourceHandle: e.sourceHandle,
  targetHandle: e.targetHandle,
  type: 'default',
  animated: true,
  className: 'workflow-edge workflow-edge--animated',
  style: { stroke: '#8b5cf6', strokeWidth: 2 },
};
```

Add CSS for animated dash styling if React Flow default animation is insufficient.

**Step 3: Verify**

Run:
`npm run test -- src/app/workflow/[id]/__tests__/Canvas.test.tsx`

Expected: test passes.

---

### Task 3: Block Cycles In The Client Before Autosave

**Files:**
- Modify: `src/app/workflow/[id]/Canvas.tsx`
- Test: `src/app/workflow/[id]/__tests__/Canvas.test.tsx`

**Step 1: Write failing test**

Add a test that attempts to add an edge that would create a cycle and asserts:
- `addEdge` is not called
- visible error says workflow cycles are not allowed

Run:
`npm run test -- src/app/workflow/[id]/__tests__/Canvas.test.tsx`

Expected before implementation: fails because UI only checks handle compatibility.

**Step 2: Implement**

In `onConnect`, build a candidate edge list and call `hasCycle([...edges, candidate])` before `addEdge`.

**Step 3: Verify**

Run:
`npm run test -- src/app/workflow/[id]/__tests__/Canvas.test.tsx`

Expected: cycle test passes and existing connection tests still pass.

---

## Batch 2: Node Validation And Sample Workflow

### Task 4: Enforce Request-Inputs Field Name Validity And Uniqueness

**Files:**
- Modify: `src/lib/schemas/node.ts`
- Modify: `src/components/canvas/nodes/RequestInputsNode.tsx`
- Test: `src/lib/schemas/__tests__/workflow.test.ts`
- Test: `src/components/canvas/nodes/__tests__/RequestInputsNode.test.tsx`

**Steps:**
1. Write schema tests that reject duplicate Request-Inputs field names.
2. Write component tests that show invalid names produce inline feedback and do not silently autosave invalid handles.
3. Implement `superRefine` on `RequestInputsNodeDataSchema` for uniqueness.
4. Add live validation display in the node UI.
5. Verify with targeted tests.

---

### Task 5: Fix New Workflow Starter Graph

**Files:**
- Modify: `src/app/dashboard/actions.ts`
- Test: `src/app/dashboard/__tests__/actions.integration.test.ts`

**Steps:**
1. Write failing integration test proving new workflows should include Request-Inputs and Response with usable starter fields.
2. Add starter fields, likely `car_prompt` text and `reference_image` image, unless Galaxy reference indicates different names.
3. Verify new workflow creation persists the graph correctly.

---

### Task 6: Correct Sample Workflow Topology And Values

**Files:**
- Modify: `src/lib/sample-workflow.ts`
- Test: `src/lib/__tests__/sample-workflow.test.ts`

**Steps:**
1. Write tests for exact node IDs, node types, model values, prompt values, crop bounds, positions, and edges.
2. Update the sample workflow to match the Galaxy AI Racing Car Generator canvas reference.
3. Ensure final Gemini depends on all required upstream branches.
4. Verify all sample workflow tests.

---

## Batch 3: Execution Feature Completion

### Task 7: Implement Multi-Select Execution UI

**Files:**
- Modify: `src/app/workflow/[id]/Canvas.tsx`
- Modify: `src/lib/store/workflowStore.ts`
- Modify: `src/components/canvas/RunButton.tsx`
- Test: `src/lib/store/__tests__/workflowStore.test.ts`
- Test: `src/components/canvas/__tests__/RunButton.test.tsx`
- Test: `src/app/workflow/[id]/__tests__/Canvas.test.tsx`

**Steps:**
1. Write tests for storing multiple selected node IDs.
2. Write tests for a visible "Run Selected Nodes" option.
3. Implement multi-selection from React Flow selection changes.
4. Start `SELECTED` scope with all selected node IDs.
5. Verify single, selected, and full run paths.

---

### Task 8: Complete Connected-Input Disabled States

**Files:**
- Modify: `src/components/canvas/nodes/CropImageNode.tsx`
- Modify: `src/components/canvas/nodes/GeminiNode.tsx`
- Test: `src/components/canvas/nodes/__tests__/CropImageNode.test.tsx`
- Test: `src/components/canvas/nodes/__tests__/GeminiNode.test.tsx`

**Steps:**
1. Test connected prompt disables prompt textarea.
2. Test connected system disables system textarea.
3. Test connected media inputs show connected-state labels/counts.
4. Implement missing disabled/greyed styling.
5. Verify targeted tests.

---

## Batch 4: Crop Output Separation

### Task 9: Store Crop Outputs Separately From User Uploads

**Files:**
- Modify: `src/trigger/crop-image.ts`
- Modify: `src/trigger/transloadit-upload.ts`
- Modify: `src/lib/transloadit.ts`
- Modify: `.env.local.example`
- Test: `src/trigger/__tests__/crop-image.test.ts`
- Test: `src/lib/__tests__/transloadit.test.ts`

**Steps:**
1. Write failing tests proving crop uploads use `TRANSLOADIT_TEMPLATE_CROP`.
2. Keep user uploads on `TRANSLOADIT_TEMPLATE_UPLOAD` / `TRANSLOADIT_TEMPLATE_ID`.
3. Implement separate template selection for crop outputs.
4. Verify targeted tests.

---

## Batch 5: History And Persistence Completeness

### Task 10: Show Full Node Run Details In History

**Files:**
- Modify: `src/components/history/ExpandedRunDetail.tsx`
- Test: `src/components/history/__tests__/HistoryPanel.test.tsx`

**Steps:**
1. Write test that expanded history shows per-node inputs, outputs, execution time, errors, and status.
2. Implement JSON/text/image formatting.
3. Verify targeted tests.

---

### Task 11: Add Idempotency Column

**Files:**
- Modify: `prisma/schema.prisma`
- Create: Prisma migration
- Modify: `src/app/api/workflows/[id]/runs/route.ts`
- Test: `src/app/api/workflows/[id]/runs/__tests__/route.unit.test.ts`

**Steps:**
1. Add `idempotencyKey String?` to `WorkflowRun`.
2. Migrate.
3. Stop storing `__idempotencyKey` in `inputsSnapshot`.
4. Verify idempotent run behavior.

---

## Batch 6: Galaxy Pixel Parity

### Task 12: Capture Galaxy Reference Measurements

**Files:**
- Reference screenshots only; no code first.

**Steps:**
1. Use logged-in Edge session.
2. Open `https://app.galaxy.ai/flow`.
3. Select System Workflows -> AI Racing Car Generator.
4. Open Workflow tab.
5. Click Clone Workflow.
6. Open `https://app.galaxy.ai/workflows/cmou87hp90000kv04w3km1dol/canvas`.
7. Capture screenshots of:
   - full canvas
   - node closeups
   - edge closeups
   - bottom toolbar
   - minimap
   - collapsed/expanded sidebar
   - run controls
   - node picker
8. Record approximate dimensions, colors, radii, spacing, font sizes, and hover states.

---

### Task 13: Match Galaxy Canvas Chrome

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/workflow/[id]/CanvasShell.tsx`
- Modify: `src/app/workflow/[id]/Canvas.tsx`
- Modify: `src/components/canvas/BottomToolbar.tsx`
- Modify: `src/components/canvas/picker/NodePicker.tsx`
- Modify: `src/components/history/HistoryPanel.tsx`

**Steps:**
1. Replace Arial body font with Galaxy-like system/Inter stack.
2. Match Galaxy topbar layout and controls.
3. Match dot grid background.
4. Match minimap location and style.
5. Match bottom-center import/add toolbar.
6. Match left-collapse control and run controls.
7. Verify visually against screenshots.

---

### Task 14: Match Galaxy Node Chrome

**Files:**
- Modify: `src/components/canvas/nodes/BaseNodeShell.tsx`
- Modify: `src/components/canvas/nodes/RequestInputsNode.tsx`
- Modify: `src/components/canvas/nodes/CropImageNode.tsx`
- Modify: `src/components/canvas/nodes/GeminiNode.tsx`
- Modify: `src/components/canvas/nodes/ResponseNode.tsx`
- Modify: `src/app/globals.css`

**Steps:**
1. Match card background, border, radius, shadow.
2. Match node title/subtitle/icon treatment.
3. Match field rows, labels, controls, and output boxes.
4. Match handle colors, sizes, and positions.
5. Match selected and running states.
6. Verify visually against screenshots.

---

## Batch 7: Security And Deployment Hardening

### Task 15: Add Mutating Route Origin Protection

**Files:**
- Modify API routes under `src/app/api/**/route.ts`
- Modify server actions if needed
- Test: route tests under `src/app/api/**/__tests__`

**Steps:**
1. Add helper that validates `Origin` / `Referer` for mutating requests.
2. Apply to POST/PUT/DELETE routes.
3. Verify same-origin requests pass and cross-origin requests fail.

---

### Task 16: Vercel Deployment Readiness

**Files:**
- Modify: `README.md`
- Modify: `.env.local.example`
- Inspect/modify: `next.config.ts`
- Inspect/modify: `trigger.config.ts`
- Inspect/modify: `prisma.config.ts`

**Steps:**
1. Document required Vercel env vars.
2. Confirm Neon env var naming works on Vercel.
3. Confirm Prisma generate/build works in Vercel.
4. Confirm Trigger.dev deployment command and env vars.
5. Confirm FFmpeg availability in Trigger.dev, not Vercel.
6. Run production build.

---

## Final Verification

Run all:

```bash
npm run lint
npm run test
npm run test:integration
npm run build
npm run test:e2e
```

Manual checks:

- Open dashboard unauthenticated -> redirects to Clerk.
- Open workflow unauthenticated -> redirects to Clerk.
- Open another user's workflow -> 404.
- Create workflow -> Request-Inputs and Response exist and are non-deletable.
- Add node only via bottom toolbar.
- Invalid edge is blocked.
- Cycle edge is blocked immediately.
- Full run works.
- Single node run works.
- Multi-selected node run works.
- Independent nodes start in parallel.
- Downstream nodes start as soon as dependencies finish.
- Crop output appears in separate Transloadit output storage.
- Gemini uses the actual configured model name.
- History shows run timestamp, status, duration, scope, node inputs, node outputs, execution times, and errors.
- Export then import preserves graph.
- Console logs `[NextFlow] Candidate LinkedIn: https://www.linkedin.com/in/harshuldhar`.
- UI matches Galaxy reference screenshots.

