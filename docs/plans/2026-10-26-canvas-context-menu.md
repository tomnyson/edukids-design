# Canvas Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Right-clicking a frame or node on the canvas opens a pen.dev-style context menu: copy, copy-as, paste, z-order, group/frame/ungroup, flex layout, flip and delete. Every item that has a shortcut also works from the keyboard.

**Architecture:**
- Pure tree operations live in a new `src/lib/node-ops.ts`. The store wraps each operation in one `pushHistory` call, so a single ⌘Z undoes it.
- A pure menu model, `src/lib/context-menu.ts`, decides which items are enabled, maps keyboard events to actions, and clamps the menu position. Both the menu and the shortcuts use it.
- `CanvasContextMenu.tsx` renders the menu, and `InfiniteCanvas` opens it on `contextmenu`.
- Flip is a new pair of optional node fields, rendered as a CSS transform.
- "Add flex layout" bakes the flex arrangement into child x/y. Canvas rendering stays absolute.

**Tech Stack:** React 19, Zustand 5, TypeScript strict, Tailwind v4, Vitest 3 (node env), Zod, lucide-react, html-to-image (through `renderPng`), and the async Clipboard API.

**Spec:** The user's request ("bo sung tinh nang sau khi click right vao frame (screen)") and the pen.dev context-menu screenshot. There is no written spec. The item list in Global Constraints is the spec.

## Global Constraints

- **Menu items, in order, with their shortcut labels verbatim from the screenshot:**
  1. Copy ⌘C
  2. Copy as ›
  3. Paste here
  4. Paste to replace ⌘⇧R
  5. Bring to Front ]
  6. Send to Back [
  7. Group selection ⌘G
  8. Frame selection ⌘⌥G
  9. Ungroup ⌘⌫
  10. Add flex layout ⇧A
  11. Remove flex layout ⇧⌥A
  12. Create Component ⌘⌥K
  13. Flip horizontal ⇧H
  14. Flip vertical ⇧V
  15. Delete ⌫ (red text)
  16. Settings ›
- **Separators** go after "Paste to replace", "Send to Back", "Ungroup", "Remove flex layout", "Create Component" and "Flip vertical", matching the screenshot's grouping.
- **Non-goals:** "Create Component" and "Settings ›" render disabled, with the tooltip `Sắp có`. The app has no component system, and the screenshot does not show what Settings contains.
- **Copy and Paste** use the existing internal store clipboard (`clipboard: ClipboardEntry[]`).
- **"Copy as"** writes to the system clipboard only. Pasting after "Copy as JSON" pastes the last internal copy, not the JSON. This is intended; do not "fix" it.
- **"Copy as" submenu:** `JSON`, `JSX`, `HTML`, `PNG`.
- **Undo:** every mutating action is exactly one undo step (one `pushHistory`).
- **Do not mutate state:** tree helpers return new arrays and objects.
- **No `console.log`.** Report failures with `notify()` from `src/lib/toast.ts`.
- **Commits:** `useDesignStore.ts`, `InfiniteCanvas.tsx`, `NodeRenderer.tsx`, `ast-to-jsx.ts`, `ast-to-html.ts` and `pen-validator.ts` already contain large uncommitted changes from earlier work.
  - Do not run any commit step until the user has committed that work or told you to commit.
  - Otherwise skip the commit steps.
  - Never `git add -A`.

## Review Focus

1. **Shortcuts the browser owns:** ⌘⇧R reloads the page, ⌘G is find-next, and ⌘⌥K opens the Firefox console.
   - Expected: the handler calls `preventDefault()`, and the action runs without a reload.
   - Where the browser wins anyway, the menu item still works and keeps its label.
   - Task 6 tests the key mapping. Task 7 checks the real browser behavior.
2. **Option-modified letters on macOS:** ⌥G produces `e.key === '©'`, so matching on `e.key` silently fails.
   - Expected: shortcuts match on `e.code` (`KeyG`, `KeyA`, `KeyK`, `BracketLeft`, ...).
   - Task 6 tests this with `{ key: '©', code: 'KeyG', metaKey: true, altKey: true }`.
3. **⌘⌫ vs. bare ⌫:** today any Backspace deletes the selection.
   - Expected: ⌘⌫ ungroups and does not delete.
   - Task 6 tests `shortcutForKey`. Task 7 checks it in the browser.
4. **Right-clicking a node inside a multi-selection:**
   - Expected: the selection is kept, and the action applies to all selected nodes.
   - Right-clicking an unselected node replaces the selection with that node.
   - Task 5 tests `selectionForContextTarget`.
5. **Grouping nodes from different parents, or ungrouping a non-frame:**
   - Expected: no change, no history entry, and an explanatory toast for grouping.
   - Task 2 tests that `historyIndex` is unchanged.

Accepted gaps, not tested:
- Ungroup ignores the frame's own rotation and flip.
- "Add flex layout" does not resize the frame.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/node-ops.ts` (new) | Pure tree operations: reorder, wrap, unwrap, flex arrangement, replace, paste-at-point placement |
| `src/store/useDesignStore.ts` | New actions that apply node-ops with one `pushHistory` |
| `src/types/pen-ast.ts`, `src/core/schema/pen-validator.ts` | `flipX` / `flipY` fields |
| `src/lib/node-transform.ts` (new) | `nodeTransform(node)` CSS transform string, shared by the canvas and the HTML export |
| `src/components/canvas/NodeRenderer.tsx`, `src/compiler/ast-to-html.ts`, `src/compiler/ast-to-jsx.ts` | Render flip |
| `src/lib/copy-as.ts` (new) | Text builders for JSON/JSX/HTML, plus system-clipboard writers |
| `src/lib/context-menu.ts` (new) | `ContextAction` type, the menu model with enabled states, `shortcutForKey`, `clampMenuPosition`, `selectionForContextTarget` |
| `src/components/canvas/context-actions.ts` (new) | `runContextAction`, which dispatches an action to the store (used by the menu and the shortcuts) |
| `src/components/canvas/CanvasContextMenu.tsx` (new) | Menu UI, the "Copy as" submenu, and closing behavior |
| `src/components/canvas/InfiniteCanvas.tsx` | `onContextMenu` wiring and shortcut dispatch |
| `tests/unit/node-ops.test.ts`, `tests/unit/copy-as.test.ts`, `tests/unit/context-menu.test.ts` (new) | Unit tests |
| `tests/unit/canvas-store.test.ts`, `tests/unit/html-export.test.ts`, `tests/unit/compiler.test.ts` | Extended tests |

---

### Task 1: Pure tree operations (`node-ops.ts`)

**Files:**
- Create: `src/lib/node-ops.ts`
- Test: `tests/unit/node-ops.test.ts`

**Interfaces:**
- Consumes:
  - `findNodeById`, `updateNodeInTree` (existing tree helpers used by the store)
  - `findParentId`, `cloneWithNewIds` from `src/lib/canvas-editing.ts`
- Produces:
  ```ts
  export type ZOrder = 'front' | 'back';
  export type WrapKind = 'group' | 'frame';
  export interface Point { x: number; y: number }

  export function reorderInParent(nodes: PenNode[], ids: string[], order: ZOrder): PenNode[];
  export function wrapNodes(nodes: PenNode[], ids: string[], kind: WrapKind, wrapperId: string): PenNode[] | null;
  export function unwrapFrames(nodes: PenNode[], ids: string[]): { nodes: PenNode[]; liftedIds: string[] };
  export function arrangeAsFlex(frame: FrameNode): FrameNode;
  export function placeAt(entries: PenNode[], target: Point): PenNode[];
  export function replaceNode(nodes: PenNode[], targetId: string, replacements: PenNode[]): PenNode[] | null;
  ```

**Behavior pinned by the tests:**
- **`reorderInParent`:**
  - Moves every id in `ids` to the end (`front`) or the start (`back`) of its own parent's `children`, or of the top level.
  - Keeps the moved nodes' relative order.
  - Ids from different parents each move within their own parent.
- **`wrapNodes`:**
  - All `ids` must share one parent. Otherwise it returns `null`.
  - The wrapper is a `FrameNode` with `id = wrapperId`, positioned at the union bounds of the wrapped nodes, with the same width and height as those bounds.
  - Wrapped children get x/y relative to the wrapper and keep their original relative order.
  - The wrapper takes the index of the highest-index wrapped node.
  - `group`: name `'Group'`, `clip: false`, no `fill`, no `stroke`, `layout: 'none'`.
  - `frame`: name `'Frame'`, `clip: true`, everything else the same.
- **`unwrapFrames`:**
  - Each id that names a frame with children is replaced, at its index, by its children, offset by the frame's x/y.
  - Ids that name non-frames, or frames without children, are ignored.
  - `liftedIds` lists the lifted children.
- **`arrangeAsFlex`:** the layout decision algorithm (direction, gap and padding are not determined by the signature):
  ```
  direction = (spread of child centre-x) >= (spread of child centre-y) ? 'row' : 'column'
  sort children by x (row) or y (column)
  gap      = round(mean over neighbours of max(0, next.start - (prev.start + prev.size))), 0 if <2 children
  padding  = frame.padding when it is a number, else max(0, round(min(min child x, min child y)))
  place: main cursor starts at padding, child.main = cursor, cursor += size + gap; child.cross = padding
  result: { ...frame, layout:'flex', flexDirection: direction, gap, padding,
            justifyContent:'start', alignItems:'start', children: sorted+placed }
  ```
  - The frame's own x, y, width and height are unchanged.
- **`placeAt`:** shifts all entries together so that the min x/y of their union bounds lands on `target`, keeping their relative offsets.
- **`replaceNode`:**
  - Inserts `replacements` at `targetId`'s index in its parent, then removes the target.
  - The replacements move together so their bounds' min corner equals the target's x/y.
  - Returns `null` if the target is missing.

- [ ] **Step 1: Write the failing tests** in `tests/unit/node-ops.test.ts`. Use one `describe` per function, with these cases:
  - `reorderInParent`:
    - `brings two siblings to front keeping their order`: `[a,b,c,d]` with ids `[a,c]`, `'front'`, gives `[b,d,a,c]`.
    - `sends a nested node to back within its frame`: `frame.children[0].id === 'x'`.
  - `wrapNodes`:
    - `wraps siblings in a frame at their union bounds`:
      - Input: a at (10,20) 50×50 and b at (100,40) 20×20.
      - The wrapper is at (10,20), 110×50.
      - The children are at (0,0) and (90,20).
      - The wrapper is at b's old index.
    - `returns null for nodes with different parents`.
    - `frame kind clips and is named Frame`: `{ name: 'Frame', clip: true }`.
  - `unwrapFrames`:
    - `lifts children into the parent offset by the frame position`:
      - Input: a frame at (100,100) with a child at (10,10).
      - The lifted child is at (110,110), at the frame's index.
      - `liftedIds` is `[childId]`.
    - `ignores non-frames`: the returned `nodes` equal the input `toEqual`.
  - `arrangeAsFlex`:
    - `infers a row with average gap`:
      - Input: three 40×40 children at x = 20, 80, 150, all at y = 20.
      - Output: `flexDirection: 'row'`, `gap: 25`, `padding: 20`.
      - Child x values are 20, 85, 150.
    - `infers a column and sorts by y`: the children are given out of order and come back sorted.
    - `keeps an explicit numeric padding`.
  - `placeAt`: `moves the group so its top-left lands on the target`.
  - `replaceNode`:
    - `swaps the target for the replacements at its index and position`.
    - `returns null for a missing target`.
  - `does not mutate inputs`: deep-freeze the input tree, then call `wrapNodes`, `unwrapFrames` and `reorderInParent` on it.

- [ ] **Step 2: Run the tests to verify they fail.**
  - Run: `npx vitest run tests/unit/node-ops.test.ts`
  - Expected: FAIL, "Failed to resolve import ../../src/lib/node-ops".

- [ ] **Step 3: Implement the six functions in `src/lib/node-ops.ts`** with the signatures above.
  - Reuse `findParentId` and the existing tree helpers.
  - Add one private `unionBounds(nodes: PenNode[])` helper.

- [ ] **Step 4: Run the tests to verify they pass.**
  - Run: `npx vitest run tests/unit/node-ops.test.ts`
  - Expected: all PASS.

- [ ] **Step 5: Commit** (subject to Global Constraints).
  ```bash
  git add src/lib/node-ops.ts tests/unit/node-ops.test.ts
  git commit -m "feat(canvas): add tree operations for z-order, grouping and flex arrangement"
  ```

---

### Task 2: Store actions

**Files:**
- Modify: `src/store/useDesignStore.ts` (the `DesignState` interface near lines 95-110 and the action bodies after `duplicateSelection`)
- Test: `tests/unit/canvas-store.test.ts` (new `describe('context menu actions')`)

**Interfaces:**
- Consumes: everything Task 1 produces, plus the existing `topmostSelected`, `pushHistory`, `generateNodeId`, `cloneWithNewIds` and `notify`.
- Produces (added to `DesignState`):
  ```ts
  reorderSelection: (order: ZOrder) => void;
  groupSelection: (kind: WrapKind) => boolean;      // false = refused (different parents / empty)
  ungroupSelection: () => void;
  addFlexLayout: () => void;                        // every selected frame with children
  removeFlexLayout: () => void;                     // every selected flex frame -> layout 'none', x/y kept
  flipSelection: (axis: 'x' | 'y') => void;         // toggles flipX / flipY
  pasteAt: (parentId: string | null, point: Point) => void;
  pasteToReplace: () => void;                       // needs clipboard and exactly one topmost selected node
  ```

**Rules:**
- Every action works on `topmostSelected(doc.children, selectedNodeIds)`.
- Every action is a no-op when nothing applies: no `pushHistory` and no state change.
- **Selection afterwards:**
  - Group/frame: the new wrapper.
  - Ungroup: `liftedIds`.
  - Paste: the new clone ids.
  - Everything else: unchanged.
- `groupSelection` returns `false` when nodes have different parents, and calls `notify('Chỉ nhóm được các layer cùng cấp')`.
- **`pasteAt`:**
  - Clones the clipboard nodes with new ids, places them with `placeAt(…, point)`, and appends them to `parentId`.
  - Falls back to the top level when that parent no longer exists.
  - It does not change `clipboard`. Only `pasteClipboard` shifts the clipboard.
- **`pasteToReplace`:** clones the clipboard nodes and calls `replaceNode` on the single selected node.

- [ ] **Step 1: Write the failing tests**:
  - `reorderSelection('front') moves the selected node last and is one undo step`:
    - The node is last after the call.
    - After `undo()`, the order is the original one.
  - `groupSelection('group') wraps siblings and selects the wrapper`:
    - `selectedNodeIds` is `[wrapperId]`.
    - The wrapper's `children.length` is 2.
  - `groupSelection refuses nodes with different parents`:
    - Returns `false`.
    - `historyIndex` is unchanged.
  - `ungroupSelection lifts children and selects them`.
  - `ungroupSelection on a rect changes nothing`: `historyIndex` is unchanged.
  - `addFlexLayout sets layout flex on the selected frame`.
  - `removeFlexLayout sets layout none and keeps child positions`.
  - `flipSelection('x') toggles flipX on and off`.
  - `pasteAt places the copy at the point inside the given frame`.
  - `pasteToReplace swaps the selected node for the clipboard node`: the old id is gone, and the new node has the old node's x/y.
  - `pasteToReplace with two selected nodes does nothing`.

  Reset the store in `beforeEach` the way the existing file does.

- [ ] **Step 2: Run the tests to verify they fail.**
  - Run: `npx vitest run tests/unit/canvas-store.test.ts`
  - Expected: FAIL, "store.reorderSelection is not a function" (or similar).

- [ ] **Step 3: Add the eight actions** to the interface and the store body, following the rules above and the style of `duplicateSelection`.

- [ ] **Step 4: Run the tests to verify they pass.**
  - Run: `npx vitest run tests/unit/canvas-store.test.ts`
  - Expected: all PASS.

- [ ] **Step 5: Commit** (subject to Global Constraints).
  ```bash
  git add src/store/useDesignStore.ts tests/unit/canvas-store.test.ts
  git commit -m "feat(store): add context menu actions (z-order, group, ungroup, flex, flip, paste)"
  ```

---

### Task 3: Flip fields and rendering

**Files:**
- Modify:
  - `src/types/pen-ast.ts` (`BaseNode`)
  - `src/core/schema/pen-validator.ts` (`BaseNodeSchema`)
  - `src/components/canvas/NodeRenderer.tsx:37`
  - `src/compiler/ast-to-html.ts:52`
  - `src/compiler/ast-to-jsx.ts` (`placementClasses` or the per-type class lists)
- Create: `src/lib/node-transform.ts`
- Test:
  - `tests/unit/html-export.test.ts`
  - `tests/unit/compiler.test.ts`
  - `tests/unit/pen-ast.test.ts`

**Interfaces:**
- Produces:
  - `flipX?: boolean; flipY?: boolean` on `BaseNode`.
  - `export function nodeTransform(node: Pick<BaseNode, 'rotation' | 'flipX' | 'flipY'>): string | undefined` in `src/lib/node-transform.ts`.
- Transform format: `rotate(Ndeg)` first, then `scale(-1, 1)`, `scale(1, -1)` or `scale(-1, -1)`, joined by one space. Returns `undefined` when none applies.

- [ ] **Step 1: Write the failing tests**:
  - `pen-ast.test.ts`: `accepts flipX and flipY booleans`.
  - `html-export.test.ts`: `renders flip combined with rotation`. `renderNodeHtml(rect with rotation 45, flipX true)` contains `transform:rotate(45deg) scale(-1, 1)`. Match the existing style serialization exactly.
  - `compiler.test.ts`: `adds flip classes to JSX`. `compileAstToJsx(rect with flipX)` contains `-scale-x-100`, and the version with `flipY` contains `-scale-y-100`.

- [ ] **Step 2: Run the tests to verify they fail.**
  - Run: `npx vitest run tests/unit/pen-ast.test.ts tests/unit/html-export.test.ts tests/unit/compiler.test.ts`
  - Expected: the 3 new tests FAIL.

- [ ] **Step 3: Implement**:
  - Add the fields and the Zod `z.boolean().optional()` entries.
  - Add `nodeTransform`.
  - Make NodeRenderer and `ast-to-html` call `nodeTransform`.
  - Make JSX append `-scale-x-100` / `-scale-y-100`.

- [ ] **Step 4: Run the tests to verify they pass.**
  - Run: `npx vitest run`
  - Expected: all PASS, with no regressions in the existing compiler and HTML tests.

- [ ] **Step 5: Commit** (subject to Global Constraints).
  ```bash
  git add src/types/pen-ast.ts src/core/schema/pen-validator.ts src/lib/node-transform.ts src/components/canvas/NodeRenderer.tsx src/compiler/ast-to-html.ts src/compiler/ast-to-jsx.ts tests/unit/pen-ast.test.ts tests/unit/html-export.test.ts tests/unit/compiler.test.ts
  git commit -m "feat(ast): add flipX/flipY rendered on canvas, HTML and JSX"
  ```

---

### Task 4: Copy as JSON / JSX / HTML / PNG

**Files:**
- Create: `src/lib/copy-as.ts`
- Test: `tests/unit/copy-as.test.ts`

**Interfaces:**
- Consumes:
  - `generateReactComponent(root, componentName)` from `ast-to-jsx`
  - `toComponentName(name)` from `jsx-export`
  - `buildHtmlDocument(root, title)` from `ast-to-html`
  - `renderPng(root)` and `dataUrlToBlob` from `frame-export`
- Produces:
  ```ts
  export type CopyFormat = 'json' | 'jsx' | 'html' | 'png';
  export function copyAsText(format: Exclude<CopyFormat, 'png'>, nodes: PenNode[]): string;
  export async function copyNodesAs(format: CopyFormat, nodes: PenNode[], clipboard?: Clipboard): Promise<void>;
  ```

**Behavior:**
- **`copyAsText`:**
  - `json`: `JSON.stringify(nodes.length === 1 ? nodes[0] : nodes, null, 2)`.
  - `jsx`: one component per node, joined by a blank line.
  - `html`: the first node only, through `buildHtmlDocument(node, node.name)`.
- **`copyNodesAs('png', …)`:**
  - Uses the first node.
  - Calls `clipboard.write([new ClipboardItem({ 'image/png': promise })])`.
  - The blob promise is passed in, not awaited first, so Safari keeps the user gesture.
- **Failures:** a missing `navigator.clipboard`, a rejected permission, or an empty `nodes` array throws `Error('Trình duyệt chặn clipboard')` or `Error('Không có layer để copy')`. The caller shows the toast.

- [ ] **Step 1: Write the failing tests**. Use a stub `{ writeText: vi.fn(), write: vi.fn() }` as `clipboard`.
  - `json of one node is the node itself`: `JSON.parse(copyAsText('json',[rect])).id === rect.id`.
  - `jsx contains an exported component named after the node`: `toContain('export')` and `toContain(toComponentName(rect.name))`.
  - `html is a full document`: `toMatch(/^<!doctype html>/i)`.
  - `copyNodesAs json writes text`: `writeText` is called with the JSON string.
  - `copyNodesAs rejects empty nodes`: rejects with `'Không có layer để copy'`.
  - `copyNodesAs rejects when clipboard is missing`: rejects with `'Trình duyệt chặn clipboard'`.

  The PNG path needs a DOM, so this file does not test it. Task 7 covers it.

- [ ] **Step 2: Run the tests to verify they fail.**
  - Run: `npx vitest run tests/unit/copy-as.test.ts`
  - Expected: FAIL, unresolved import.

- [ ] **Step 3: Implement `copyAsText` and `copyNodesAs`** in `src/lib/copy-as.ts`. `clipboard` defaults to `navigator.clipboard` when it is defined.

- [ ] **Step 4: Run the tests to verify they pass.**
  - Run: `npx vitest run tests/unit/copy-as.test.ts`
  - Expected: all PASS.

- [ ] **Step 5: Commit** (subject to Global Constraints).
  ```bash
  git add src/lib/copy-as.ts tests/unit/copy-as.test.ts
  git commit -m "feat(canvas): copy layers as JSON, JSX, HTML or PNG"
  ```

---

### Task 5: Menu model and context menu UI

**Files:**
- Create:
  - `src/lib/context-menu.ts`
  - `src/components/canvas/context-actions.ts`
  - `src/components/canvas/CanvasContextMenu.tsx`
- Modify: `src/components/canvas/InfiniteCanvas.tsx` (add `onContextMenu` on the container and render the menu)
- Test: `tests/unit/context-menu.test.ts`

**Interfaces:**
- Consumes: the Task 2 store actions, `copyNodesAs` (Task 4), `notify`, `useEscapeToClose`, `isEditableTarget`, and `frameElementAt` (an existing local helper in InfiniteCanvas).
- Produces:
  ```ts
  // src/lib/context-menu.ts
  export type ContextAction =
    | 'copy' | 'paste-here' | 'paste-replace' | 'bring-front' | 'send-back'
    | 'group' | 'frame' | 'ungroup' | 'add-flex' | 'remove-flex'
    | 'create-component' | 'flip-h' | 'flip-v' | 'delete';
  export interface MenuContext {
    targetIsNode: boolean;
    selection: PenNode[];          // topmost selected nodes
    sameParent: boolean;
    hasClipboard: boolean;
  }
  export interface MenuEntry {
    kind: 'item' | 'submenu' | 'separator';
    action?: ContextAction; label: string; shortcut?: string;
    enabled: boolean; danger?: boolean; hint?: string;
  }
  export function buildMenu(ctx: MenuContext): MenuEntry[];
  export function selectionForContextTarget(selectedIds: string[], targetId: string | null): string[];
  export function clampMenuPosition(point: Point, menu: { width: number; height: number }, viewport: { width: number; height: number }): Point;

  // src/components/canvas/context-actions.ts
  export interface PasteTarget { parentId: string | null; point: Point }
  export function runContextAction(action: ContextAction, paste?: PasteTarget): void;
  ```

**Enabled rules (`buildMenu`):**
- `targetIsNode: false`: the menu contains only "Paste here", enabled when `hasClipboard`.
- Copy, Copy as, Bring to Front, Send to Back, Flip ×2 and Delete: `selection.length >= 1`.
- Paste here: `hasClipboard`.
- Paste to replace: `hasClipboard && selection.length === 1`.
- Group/Frame selection: `selection.length >= 1 && sameParent`.
- Ungroup: some selected node is a frame with children.
- Add flex layout: some selected frame has children and `layout !== 'flex'`.
- Remove flex layout: some selected frame has `layout === 'flex'`.
- Create Component and Settings: always disabled, `hint: 'Sắp có'`.
- Delete: `danger: true`.

**Other rules:**
- **`selectionForContextTarget`:** returns `selectedIds` when the target is already in it, `[targetId]` when the target is not, and `[]` for `null`.
- **`clampMenuPosition`:** keeps the menu inside the viewport with an 8px margin, and flips it left or up when it would overflow.
- **UI:**
  - `role="menu"`, with `role="menuitem"` buttons. Disabled items use `aria-disabled` and the `title` hint.
  - "Copy as" opens its submenu on hover or focus. On submenu overflow, the submenu flips to the left side.
  - Closes on: Escape (`useEscapeToClose`), outside `mousedown`, `wheel` on the canvas, window `blur`, and after any action.
  - Styling follows `AgentSessionMenu`: `bg-[#141520] border-[#2a2c40] rounded-xl shadow-2xl`, with red text for Delete.
  - Copy-as errors show `notify(\`❌ ${message}\`)`. Success shows `notify('📋 Đã copy dạng JSON')` (with the format name).
- **Canvas wiring:**
  - `onContextMenu` always calls `preventDefault()`, unless `isEditableTarget(e.target)`, so text being edited keeps the native menu.
  - It resolves the node under the pointer through the `NODE_ID_PREFIX` closest-match, applies `selectionForContextTarget`, and computes `PasteTarget`.
    - Over a frame (`frameElementAt`): the parent is that frame, and the point is `(clientX - frameRect.left) / zoom`.
    - Otherwise: the parent is `null`, and the point is the canvas conversion `(clientX - rect.left - viewport.x) / zoom`.
  - `handleMouseDown` must ignore `e.button === 2`. Check the existing branches; add `if (e.button === 2) return;` first.

- [ ] **Step 1: Write the failing tests** in `tests/unit/context-menu.test.ts`:
  - `empty canvas menu only offers paste here`: one item, `action: 'paste-here'`.
  - `full menu lists the 16 entries in screenshot order with shortcut labels`: the labels (separators filtered out) equal the Global Constraints list, and `shortcut` values match.
  - `group is disabled across parents`.
  - `ungroup is enabled only for frames with children`.
  - `add flex disabled for an already flex frame; remove flex enabled`.
  - `paste to replace needs exactly one selected node and a clipboard`.
  - `create component and settings are disabled with a hint`.
  - `selectionForContextTarget keeps a multi-selection containing the target`: `(['a','b'],'b')` gives `['a','b']`, `(['a','b'],'c')` gives `['c']`, and `(['a'],null)` gives `[]`.
  - `clampMenuPosition keeps the menu on screen`: `({x:990,y:700},{width:220,height:400},{width:1000,height:800})` gives `x <= 772` and `y <= 392`.

- [ ] **Step 2: Run the tests to verify they fail.**
  - Run: `npx vitest run tests/unit/context-menu.test.ts`
  - Expected: FAIL, unresolved import.

- [ ] **Step 3: Implement** `context-menu.ts`, then `context-actions.ts` (a `switch` over `ContextAction` that calls the store), then `CanvasContextMenu.tsx`, then the InfiniteCanvas wiring.

- [ ] **Step 4: Run all tests, the type check and the build.**
  - Run: `npx vitest run && npx tsc --noEmit && npm run build`
  - Expected: all PASS, 0 type errors, build OK.

- [ ] **Step 5: Commit** (subject to Global Constraints).
  ```bash
  git add src/lib/context-menu.ts src/components/canvas/context-actions.ts src/components/canvas/CanvasContextMenu.tsx src/components/canvas/InfiniteCanvas.tsx tests/unit/context-menu.test.ts
  git commit -m "feat(canvas): right-click context menu for layers"
  ```

---

### Task 6: Keyboard shortcuts

**Files:**
- Modify:
  - `src/lib/context-menu.ts`
  - `src/components/canvas/InfiniteCanvas.tsx` (the keydown handler, lines 208-255)
- Test: `tests/unit/context-menu.test.ts`

**Interfaces:**
- Consumes: `ContextAction` and `runContextAction` (Task 5).
- Produces:
  ```ts
  export function shortcutForKey(e: { code: string; key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): ContextAction | null;
  ```

**Mapping.** Match on `e.code`. `mod` means `metaKey || ctrlKey`. Every row requires the listed modifiers exactly, with all other modifiers off:

| Keys | `code` | Action |
|------|--------|--------|
| ⌘⇧R | `KeyR` | `paste-replace` |
| ] | `BracketRight` | `bring-front` |
| [ | `BracketLeft` | `send-back` |
| ⌘G | `KeyG` | `group` |
| ⌘⌥G | `KeyG` | `frame` |
| ⌘⌫ | `Backspace` | `ungroup` |
| ⇧A | `KeyA` | `add-flex` |
| ⇧⌥A | `KeyA` | `remove-flex` |
| ⇧H | `KeyH` | `flip-h` |
| ⇧V | `KeyV` | `flip-v` |

- Copy (⌘C) and Delete (⌫) keep their existing branches.
- ⌘⌥K is not mapped, because Create Component is a non-goal.

**Handler placement:** right after the `Space` branch and before the `Backspace`/`Delete` branch:

```ts
const action = shortcutForKey(e);
if (action) { e.preventDefault(); runContextAction(action); return; }
```

- [ ] **Step 1: Write the failing tests**:
  - `maps every shortcut`: one assertion per table row.
  - `matches option letters by code on macOS`: `{ code:'KeyG', key:'©', metaKey:true, altKey:true }` gives `'frame'`.
  - `bare backspace is not ungroup`: `{ code:'Backspace' }` gives `null`.
  - `does not steal redo or plain letters`:
    - `{ code:'KeyZ', metaKey:true, shiftKey:true }` gives `null`.
    - `{ code:'KeyA' }` gives `null` (A stays free for tools).
    - `{ code:'KeyA', metaKey:true }` gives `null` (⌘A select all).
    - `{ code:'KeyV', metaKey:true }` gives `null` (⌘V paste).

- [ ] **Step 2: Run the tests to verify they fail.**
  - Run: `npx vitest run tests/unit/context-menu.test.ts`
  - Expected: FAIL, "shortcutForKey is not a function".

- [ ] **Step 3: Implement `shortcutForKey`** as a lookup over the table, and insert the handler branch.

- [ ] **Step 4: Run all tests and the type check.**
  - Run: `npx vitest run && npx tsc --noEmit`
  - Expected: all PASS, 0 type errors.

- [ ] **Step 5: Commit** (subject to Global Constraints).
  ```bash
  git add src/lib/context-menu.ts src/components/canvas/InfiniteCanvas.tsx tests/unit/context-menu.test.ts
  git commit -m "feat(canvas): keyboard shortcuts for context menu actions"
  ```

---

### Task 7: Browser verification

**Files:** none changed, unless a defect is found. Fix defects in the owning task's files and add a regression test there.

- [ ] **Step 1: Start the dev server** with `npm run dev`. Open it with Playwright at 1440×900.

- [ ] **Step 2: Check right-click.**
  - Right-click a frame: the menu shows the 16 entries, in order, with their shortcut labels.
  - Right-click empty canvas: only "Paste here".
  - Right-click near the bottom-right corner: the menu stays fully on screen.
  - Right-click does not start a pan or a drag.

- [ ] **Step 3: Run the actions from the menu.** Run each item once on a generated design, then check that the layer tree matches and that one ⌘Z restores it:
  - Bring to Front / Send to Back
  - Group / Frame selection / Ungroup
  - Add / Remove flex layout
  - Flip ×2
  - Delete
  - Paste here (lands under the cursor, inside the frame)
  - Paste to replace

- [ ] **Step 4: Check "Copy as".**
  - JSON, JSX and HTML: read back with `navigator.clipboard.readText()` (grant `clipboard-read`).
  - PNG: `navigator.clipboard.read()` contains `image/png`.

- [ ] **Step 5: Press each shortcut.**
  - Shortcuts: ⌘⇧R, ⌘G, ⌘⌥G, ⌘⌫, ⇧A, ⇧⌥A, ⇧H, ⇧V, ], [.
  - Expected for each: the action fired, and `performance.getEntriesByType('navigation').length` is unchanged (no reload).
  - Record any shortcut the browser wins in the final report. Its menu item must still work.

- [ ] **Step 6: Clean up.** Close the browser, stop the dev server, and delete `.playwright-mcp/`.
