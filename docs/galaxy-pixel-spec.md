# Galaxy.ai Canvas — Pixel Spec

Source: live DOM dump captured 2026-05-06 from
`https://app.galaxy.ai/workflows/cmou87hp90000kv04w3km1dol/canvas`
(`scripts/.playwright-dumps/dom-2026-05-06T17-35-45-658Z.html`).

This is the authoritative reference for matching NextFlow's canvas to
Galaxy.ai. All values were extracted from the actual rendered DOM and
the production Tailwind stylesheet served from `_next/static/css`.

## Brand color (`workflow-accent`)

Galaxy's "workflow-accent" palette is Tailwind's **indigo** scale:

| Token | RGB | Hex |
|---|---|---|
| `workflow-accent-400` | `129 140 248` | `#818cf8` |
| `workflow-accent-500` | `99 102 241`  | `#6366f1` |
| `workflow-accent-600` | `79 70 229`   | `#4f46e5` |

NextFlow had been using violet (`#8b5cf6`); we switch to indigo to match.

## Canvas

- Background color: `#F4F4F4`
- Dot pattern: gap `19.17px`, dot radius `0.77px`, fill `#cacaca`
- React Flow wrapper: `data-testid="rf__wrapper"` with `class="react-flow bg-[#F4F4F4]"`

## Edges

```html
<path d="..." fill="none" stroke="#22c55e" stroke-width="2"
  stroke-linecap="round" style="opacity: 0.8; pointer-events: none;" />
```

- Galaxy uses **static** edges (no `animated`, no dasharray).
- Stroke color appears to track the source-handle type (text=indigo,
  image=green, etc.). NextFlow keeps the spec-mandated animated purple
  edges; we ship indigo as the brand purple variant.

## Node card

```html
<div class="w-[380px] rounded-xl border shadow-2xl bg-white border-gray-200">
  <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
    <span class="text-sm font-medium text-gray-900">{title}</span>
    <button class="h-8 w-8 rounded-lg border border-gray-200 bg-[#F5F5F5]">…</button>
  </div>
  <div class="px-4 py-4 space-y-4">…</div>
</div>
```

- Width: fixed **380px** (`min-width`/`max-width` both 380)
- Radius: `rounded-xl` (12px)
- Shadow: `shadow-2xl`
- Header divider: `border-b border-gray-100`
- Title weight: `font-medium` (Request-Inputs) or `font-semibold` (Response)
- Selected ring: `ring-2 ring-workflow-accent-500` (indigo-500)
- Response node (and other LLM-style nodes) prepend an icon tile:
  `<div class="flex h-8 w-8 items-center justify-center rounded-lg
   bg-workflow-accent-500/10 text-workflow-accent-500">…icon…</div>`

## Handles

```html
<div class="pointer-events-none absolute flex items-center"
     style="right: -21px; top: 50%; transform: translateY(-50%); z-index: 50">
  <div data-handleid="result"
       class="react-flow__handle react-flow__handle-right
              nodrag nopan !h-3.5 !w-3.5 !rounded-full !border-2
              source connectable …"
       style="left: -21px; top: 50%; transform: translateY(-50%);
              background: rgb(99, 102, 241); border-color: rgb(99, 102, 241);
              box-shadow: rgba(99, 102, 241, 0.314) 0px 0px 8px;
              cursor: crosshair; --handle-color: #6366f1;">
  </div>
</div>
```

- Size: **14×14px** (`!h-3.5 !w-3.5`)
- Border: `!border-2` solid in same hue as fill (sometimes 50% alpha)
- Shadow: `box-shadow: rgba(<hue>, 0.314) 0 0 8px` — colored glow
- Position: outer wrapper at `right:-21px` (output) or `left:-22px` (input),
  vertically centered with the row (label or content)
- Custom property `--handle-color: <hex>` carried for downstream use
- Color by type (observed):
  - prompt / text in: `#f59e0b` (amber-500)
  - text result out: `#6366f1` (indigo-500)
  - (image / vision colors not observed in this workflow)

## Field row & “tab” flow (all LLM / tool nodes)

Galaxy does **not** stack a bold label above every control. Primary inputs use a
**horizontal flow**:

- Outer row: `flex items-start gap-3`
- **Label column** (left): `shrink-0 pt-2 text-xs text-gray-500` — muted, not
  `font-medium text-gray-900`
- **Control column** (right): `min-w-0 flex-1` — textarea, select, or nested UI

Optional / secondary slots (upload, vision previews, “add item”) sit inside a
**dashed panel** — not a solid gray card:

- `rounded-lg border border-dashed border-gray-300 bg-[#F5F5F5] px-3 py-2.5`
- Hover tightens toward the accent: `hover:border-workflow-accent-400`

The **model output** block is separated from inputs by a hard divider:

- `mt-4 border-t border-gray-100 pt-4`
- Section caption: `mb-1.5 text-xs text-gray-500`
- Output well: `rounded-lg border border-gray-200 bg-[#F5F5F5] min-h-[120px] p-2`
- Empty state: centered `text-gray-400` / `py-10` “No output yet”

**Pill tabs** (e.g. “Text to Video” / “Image to Video” on Sora nodes) use:

- Track: `flex w-full rounded-[18px] border border-gray-200 bg-gray-100 p-1`
- Inactive pill: `flex-1 rounded-[14px] px-3 py-1.5 text-xs font-medium text-gray-500`
- Active pill: `… bg-gray-900 text-white shadow-md` (dark mode inverts)

NextFlow maps these patterns onto Gemini / Crop / Response via shared layout
helpers in `src/components/canvas/nodes/galaxy-field-layout.tsx`.

## Field row (Request-Inputs)

```html
<div class="mb-2 flex w-full min-w-0 items-center gap-2">
  <div class="cursor-grab text-gray-400"><svg lucide-grip-vertical w-3.5 h-3.5/></div>
  <span class="text-xs font-medium text-gray-900">{name}</span>
  <button class="rounded p-1 text-gray-400 hover:bg-gray-100">{copy}</button>
  <button class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500">{trash}</button>
</div>
<textarea class="w-full resize-y rounded-lg border border-gray-200
                 bg-[#F5F5F5] px-3 py-2 text-sm text-gray-900 outline-none
                 focus:border-workflow-accent-500" rows="3"
          placeholder="Enter text..."></textarea>
```

## Bottom-center toolbar (the "+" picker)

```html
<div class="react-flow__panel mb-4 bottom center">
  <div class="flex items-center gap-1 rounded-xl border border-gray-200
              bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur-sm">
    <button class="rounded-lg p-2 text-gray-700 hover:bg-gray-100">
      {sticky-note icon h-4 w-4}
    </button>
    <button class="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            title="Add node">
      {plus icon h-4 w-4}
    </button>
  </div>
</div>
```

This is **not** a giant filled circle — it's a small subtle pill of
icon buttons. NextFlow currently ships a violet round button; we
should match this Galaxy pill.

## Top-right action cluster

```html
<div class="react-flow__panel mr-4 mt-2 top right">
  <div class="flex flex-col items-end gap-2">
    <div class="flex items-center gap-2">
      {Est badge: white pill h-7 px-2.5 with calculator + value}
      {Bal badge: white pill h-7 px-2.5 with wallet + value}
      <button class="flex h-8 w-9 items-center justify-center rounded-lg
                     border border-workflow-accent-400 bg-workflow-accent-500
                     text-white shadow-sm">{play icon}</button>
      <button class="flex h-8 w-9 items-center justify-center rounded-lg
                     border border-gray-200 bg-white text-gray-800 shadow-sm">
        {clock icon}
      </button>
    </div>
  </div>
</div>
```

- Run button: small icon-only, **32×36 px**, indigo-500 fill with indigo-400 border
- History button: same dimensions, white with grey border

## Bottom-left collapse-arrow panel

```html
<div class="react-flow__panel mb-4 ml-4 bottom left">
  <div class="flex items-center gap-1 rounded-xl border border-gray-200
              bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur-sm">
    <button class="rounded-lg p-2 text-gray-700 hover:bg-gray-100">
      {chevron-right h-3.5 w-3.5}
    </button>
  </div>
</div>
```

## Floating "Show minimap" toggle

```html
<button class="absolute rounded-lg border border-gray-200 bg-white p-1.5
               text-gray-500 shadow-sm" style="bottom:16px; right:75px; z-index:20">
  {map icon h-4 w-4}
</button>
```

## Typography

Galaxy ships **Inter** via `next/font` (self-hosted woff2). The metric
fallback uses Arial with the standard ascent/descent overrides next/font
applies. NextFlow now self-hosts the same exact woff2 files locally
under `/public/fonts/inter-*.woff2` so we do not depend on Google Fonts
at build time.
