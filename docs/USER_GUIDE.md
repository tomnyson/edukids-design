# Pen Studio User Guide: Workflow & Consultation with Claude Opus

## 1. Canvas Navigation
- **Pan:** Click and drag the canvas background with the **Select (V)** tool, hold **Spacebar** while dragging, or use middle-click.
- **Zoom:** Pinch on trackpad or hold **Cmd / Ctrl** while scrolling the mouse wheel. Click the zoom percentage in the bottom right corner or hit **Reset** to return to standard view.
- **Undo / Redo:** Use the toolbar buttons or standard keyboard shortcuts **Cmd+Z** / **Cmd+Shift+Z**.

## 2. Drawing & Editing Elements
- Select **Frame (F)** from the toolbar and click the canvas to drop a new responsive artboard.
- Select **Rectangle (R)** or **Text (T)** to add shapes or typography.
- Use the **Properties Inspector** on the right sidebar to change position, dimensions, fills, strokes, corner radius, and flexbox auto-layout parameters (gap, padding, direction).

## 3. Working with `.pen` Files
- **Import:** Click **Import** in the top navigation to load any `.pen` or JSON file (e.g. `docs/specs/reverse-engineered/pencil-welcome.pen`).
- **Export:** Click **Save .pen** to export your canvas into a version-controlled `.pen` file.

## 4. Consulting Claude Opus Advisor
1. Click the **Claude Opus Advisor** button in the top navbar (or open the purple drawer on the right).
2. (Optional) Click the **Key** icon to enter your Anthropic API Key (`sk-ant-...`). If left empty, the Advisor operates using the built-in heuristic engine.
3. Choose a Quick Audit:
   - **WCAG Audit:** Checks for minimum touch targets (>= 44px) and color contrast.
   - **Spacing Grid:** Checks compliance with the 8pt spacing system.
   - **Architecture:** Analyzes component hierarchy, auto-layout, and nesting.
4. When a critique card appears with a **"Fix available"** tag, click **Apply Suggestion** to immediately update the canvas.

## 5. Bidirectional Code Sync
- Click **React JSX** in the top bar.
- **Export Tab:** View and copy the semantic React 19 component with Tailwind CSS classes corresponding to your selected canvas element.
- **Paste JSX Tab:** Paste custom JSX / HTML with Tailwind classes to convert it into a canvas frame.
