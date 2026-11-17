# EduKids Design: AI Design-as-Code Canvas & Studio

An open, high-performance **Design-as-Code Canvas** application compatible with **pen.dev** (`.pen` format v2.13), reverse-engineered using **REA MCP** (`morluto/rea`), featuring a built-in **Local MCP Server** and an integrated **Claude Opus Advisor** for architectural, design system, and UX consultations.

---

## Key Features

1. **Infinite 2D Vector Canvas**
   - Infinite dot grid workspace with smooth cursor-centric zoom (0.1x to 5x) and middle-click / spacebar panning.
   - Recursive rendering engine supporting Frames, Flexbox Auto-Layout, Typography, Rectangles, and SVG Paths.
   - Interactive property inspection (positions, dimensions, color fills, borders, corner radii, flex directions, gap, and typography).
   - Document layer tree with nesting, selection, and deletion.

2. **Full pen.dev (.pen) Compatibility**
   - Reads and writes version 2.13 `.pen` documents directly (JSON AST).
   - Version-controlled design files that live inside your code repository for clean Git diffs.
   - Includes real reverse-engineered sample assets (`pencil-welcome.pen`).

3. **Bidirectional Code Sync (Canvas AST <-> React + Tailwind JSX)**
   - **AST to JSX**: Instantly compile canvas frames, flex layouts, and design tokens into semantic React 19 JSX components styled with Tailwind CSS.
   - **JSX to Canvas**: Paste JSX or HTML markup to translate it directly into canvas elements.

4. **Embedded Local MCP Server (Model Context Protocol)**
   - Implements the 7 core MCP tools reverse-engineered from Pen.app:
     - `get_app_state`: Returns active AST, layers, viewport, and selection.
     - `execute`: Performs JavaScript mutations or surgical find/replace text edits.
     - `get_style`: Exposes theme variables and design tokens.
     - `import_website`: Captures and transforms web URLs into canvas frames.
     - `browser`: Headless browser actions and CDP automation.
     - `read_skill`: Delivers agent guidelines for 8pt grid and flex layout rules.
     - `spawn_agents`: Launches background multi-agent workers.
   - Standalone CLI executable `bin/pen-mcp.js` for stdio connection in Cursor, Windsurf, or Claude Code.

5. **Claude Opus Advisor Module**
   - Senior Software Architect & Design System Consultant embedded directly in the canvas.
   - Supports live calls to Anthropic's `claude-3-opus-20240229` (and `claude-3-5-sonnet`).
   - Built-in High-Fidelity Heuristic Engine when no API key is supplied (audits WCAG 2.1 AA touch targets, 8pt spacing grid alignment, typography scale, and layout structure).
   - Interactive critique cards with one-click **"Apply Suggestion"** to mutate canvas nodes live.

---

## Quick Start

### 1. Run the Web Studio
```bash
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 2. Connect an External Coding Agent via MCP

Add the local MCP server to your agent's MCP configuration file (e.g. `~/.cursor/mcp.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "edukids-design": {
      "command": "node",
      "args": ["/Applications/work/web-creator-ai/bin/pen-mcp.js"]
    }
  }
}
```

### 3. Run Automated Tests
```bash
npm test
```
Runs 20 automated tests covering AST validation, canvas state, JSX compiler, MCP tools, Advisor heuristics, and full E2E workflow.

---

## Architecture & Reverse-Engineering Insights

This system was reverse-engineered from `/Applications/Pen.app` (`app.asar`) using **REA MCP** (`morluto/rea`).
- **AST Specifications:** documented at [`docs/specs/pen-dev-ast-schema.md`](docs/specs/pen-dev-ast-schema.md)
- **MCP Protocol Contracts:** documented at [`docs/specs/mcp-protocol-spec.md`](docs/specs/mcp-protocol-spec.md)
- **Detailed Implementation Plan:** documented at [`docs/plans/2026-10-26-pen-dev-rea-advisor.md`](docs/plans/2026-10-26-pen-dev-rea-advisor.md)
# edukids-design
