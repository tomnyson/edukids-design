# Parallel agents: progressive results and planned Split Work

Date: 2026-11-17
Status: awaiting approval

## Intent

The Parallel Agents popover (1x–6x, Split Work / Side by Side) already fires N
requests at once, but nothing on screen shows it. The canvas stays empty until
every agent has finished, the chat shows a single "Đang sinh thiết kế…" line,
and Split Work cuts every prompt into the same hardcoded landing-page sections
with no shared style.

The user wants to *see* the agents working in parallel: each frame appears the
moment its agent finishes, each agent has its own progress line, and Split Work
divides the page according to the prompt with one shared palette and font plan.

## Goals

1. When a run starts, the canvas immediately shows N placeholders in their
   final slots, labelled with the agent number and what it is building.
2. Each placeholder is replaced by the real frame as soon as that agent
   finishes, independent of the others.
3. The chat reply lists every agent with its label, status and duration.
4. Split Work runs a planning step first. The plan derives N sections from the
   prompt and fixes page width, palette and fonts for all agents.
5. If planning fails for any reason, Split Work falls back to today's hardcoded
   section list and style and still generates.
6. A whole run is exactly one undo step.

## Non-goals

- Several runs at the same time. One run at a time stays; the input stays
  locked while `isGenerating`.
- Cancelling a single agent or a run.
- A cap on concurrent CLI processes (max stays 6 agents + 1 planner call).
- Merging Split Work sections into a single page frame. They stay N frames
  stacked with no gap, as today.
- Streaming a frame node by node while its agent is still writing.
- A planning step for Side by Side. It keeps the fixed art directions.

## Anti-goals

- A placeholder or half-finished run ending up in a saved `.pen` file, an
  export, the undo history or the layer tree.
- A planner failure blocking or failing the run.
- More than one ⌘Z needed to remove a run's output.
- One agent failing hiding the frames of agents that succeeded.

## Constraints

- Both backends must keep working: the local `claude` CLI bridge
  (`server/claude-bridge-plugin.ts`) and the browser SDK with an API key. Both
  go through the `CreateMessage` function type; nothing new may bypass it.
- The bridge validates requests with `BridgeRequestSchema` (exactly one tool,
  forced tool choice, one user message). The planner request must fit that
  shape. `parseCliResult` currently hardcodes `DESIGN_TOOL_NAME` in the
  tool-use block it returns; it must return the requested tool's name instead.
- The result must land in the tab that was active when the prompt was sent,
  even if the user switches tabs meanwhile (existing behaviour).
- Repo rules: immutable updates, files under 800 lines, zod validation of all
  model output, tests first (vitest, `tests/unit`).

## Approaches

### Showing results on the canvas

- **A. Reserve slots, replace as agents finish (chosen).** N placeholders
  appear at once in final positions; each is swapped for the real frame when
  ready. Shows parallelism from the first second and keeps agent order stable.
  Most work: needs slot layout that reflows and a way to keep in-flight frames
  out of history.
- **B. Append each frame when it finishes, no placeholders.** Simpler, but the
  canvas is empty until the first agent returns, Side by Side ends up in
  completion order, and Split Work still needs reflow.
- **C. Canvas unchanged, progress only in chat.** Cheapest; does not meet
  "the frame appears as soon as it is done".

A was picked because it is the only one that shows all N agents working from
the start.

### Shared style for Split Work

- **Planner call, then N agents in parallel (chosen).** One small extra request
  before the fan-out.
- **Agent 1 goes first, the rest copy its style.** Sequential; defeats the
  point.
- **No coordination, richer prompt only.** Agents still cannot agree on a
  palette they each invent.

## Design

### Run state lives outside the document (builder's call, flagged)

The chosen approach was described as "placeholders in the document, replaced by
id, no history writes until the end". Putting placeholders into
`document.children` breaks that promise in three ways: any user edit during the
run snapshots the placeholders into history, an undo during the run deletes
them from under the agents, and saving mid-run writes them to disk.

So the run is held in store state next to the document, not in it:

```ts
interface GenerationSlot {
  id: string;            // stable slot id; lookup key for updates
  index: number;         // agent order, 0-based
  label: string;         // section name or art-direction name
  status: 'queued' | 'running' | 'done' | 'error';
  width: number;         // planned size until done, real size after
  height: number;
  frame?: FrameNode;     // set when status is 'done'
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

interface GenerationRun {
  id: string;
  tabId: string;
  direction: 'row' | 'column';
  origin: { x: number; y: number };
  slots: GenerationSlot[];
}
```

- At most one run exists. It is created when generation starts and removed
  when it ends.
- `origin` is computed once at run start with the same rule `placeDesigns`
  uses today (right of existing content, or the canvas origin when empty).
- A pure function lays out slots from `origin`: `row` advances x by slot width
  plus the existing 80px gap; `column` advances y by slot height with no gap.
  When a slot's real size replaces its planned size, later slots shift. Failed
  slots take no space once the run commits.
- `InfiniteCanvas` draws the active tab's run after `doc.children`, inside the
  same viewport transform: finished slots through `NodeRenderer`, the others as
  a placeholder component. Run content is not selectable, draggable or listed
  in the layer tree until committed.
- **Commit:** when every slot is `done` or `error`, the finished frames are
  appended to the target tab's document at their laid-out positions with a
  single `pushHistory`, and the run is cleared. The existing
  `appendGeneratedDesigns` tab-switch handling is kept.
- No finished frame: nothing is committed; the run is cleared and the reply is
  an error, as today.
- Target tab closed mid-run: the run is cleared and results are dropped, with
  today's warning message.
- Page reload mid-run: the run is in-memory only and is lost; the chat reply
  becomes "interrupted" through the existing restore path.

Placeholder look: a dashed frame at the slot's size with "Agent 2 · Pricing"
and a spinner; an error placeholder shows the short error until commit.
Default slot size before real data: 1280×800 for Side by Side; the plan's
width and each section's estimated height for Split Work.

### Viewport (builder's call, flagged)

Slots sit to the right of existing content, so without moving the view the
placeholders are usually off screen.

- At run start, if the target tab is the active tab and the canvas view is
  showing, the viewport pans and zooms once so the whole run fits with a
  margin. Zoom is clamped to the canvas's existing zoom limits.
- The view is not moved again: not on reflow, not when a frame lands, not at
  commit. The user is free to pan and zoom during the run.
- If the target tab is in the background, its viewport is left alone.

### Planner (Split Work with 2+ agents only)

One request through the same `CreateMessage`, same model as the run
(builder's call), small `max_tokens`. Forced tool `plan_page`:

```ts
interface PagePlan {
  width: number;                    // 320–1920
  palette: { background: string; surface: string; text: string; mutedText: string; accent: string };
  fonts: { heading: string; body: string };
  styleNotes: string;               // one or two sentences
  sections: { name: string; brief: string; estimatedHeight: number }[];
}
```

- The request states N; the plan must come back with exactly N sections, in
  page order, in the language of the prompt. Attachments are sent to the
  planner too.
- Validated with zod. Wrong section count, invalid shape, truncated output,
  thrown error: use the fallback plan built from today's `sectionFor` list and
  `VARIANT_DIRECTIONS[0]`, default width 1280, default height 800 per section.
  The reply notes that the fallback was used.
- A slow planner is a failed planner (builder's call): after 60 seconds the
  fallback plan is used and a late planner result is ignored. The abandoned
  planner call is allowed to keep running until its backend ends it; no abort
  plumbing is added, since cancelling is a non-goal.
- Each section agent's brief carries: its section name and brief, the full
  ordered section list (so it knows its neighbours), exact width, palette hex
  values, fonts, style notes, and the existing "full width, no outer margin
  above or below" instruction.
- While planning, all slots are `queued` with labels "Agent 1…N"; labels switch
  to section names when the plan arrives, then all agents start together.

### Progress reporting

`generateDesigns` takes an optional progress callback and reports: plan
started, plan ready (with a fallback flag), agent started, agent finished
(with frame), agent failed (with message). Its returned result keeps today's
shape and index order. The hook translates events into run-slot updates and
chat updates.

### Chat reply

`ChatMessage` gains an optional `agents` list (`label`, `status`, `durationMs`,
`error`). `ChatTranscript` renders it under the reply text as one row per
agent: status icon, "Agent 2 · Pricing", and duration or error. During
planning the reply text reads as planning; afterwards it reads as generating
k/N; the final text keeps today's summary wording. The persisted-chat zod
schema accepts the new optional field; old stored chats stay valid.

The progress toast stays; the final toast is unchanged.

### Popover

The lock icons on 2x–6x are removed; every count shows the same bolt style,
since all counts work (builder's call, cosmetic).

## Testing

Unit tests first, in `tests/unit`:

- plan request shape passes `BridgeRequestSchema`; plan parsing accepts a good
  plan and falls back on wrong count, bad shape, thrown errors and the
  60-second deadline (fake timers)
- fit-to-run viewport maths; no viewport change for a background tab
- section briefs contain the plan's palette, fonts, width and section list
- slot layout for row and column, including reflow when real sizes arrive and
  failed slots
- `generateDesigns` emits progress events in a valid order with agents
  finishing out of order, and still returns results in index order
- store: run start, slot update by id, commit produces exactly one history
  entry, undo removes the whole run, document is untouched before commit,
  closed-tab run is dropped
- `parseCliResult` returns the requested tool name
- chat restore accepts messages with and without `agents`
- component tests: transcript agent rows; placeholder rendering

## Left to the builder

- File and function names, where the run state and layout function live, and
  how `InfiniteCanvas` makes run content non-interactive.
- Exact prompt wording for the planner and section briefs.
- Placeholder and agent-row styling, within the app's existing dark look.
- Whether the duration ticks live or appears on finish.
