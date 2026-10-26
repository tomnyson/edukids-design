# pen.dev Local MCP Protocol Specification

Reverse-engineered from `/Applications/Pen.app` (`@ha/mcp`).

The local MCP server provides tools allowing external AI coding agents (Claude Code, Cursor, Windsurf, Antigravity) to act as visual design engineers directly inside the application.

## Tool Catalog

### 1. `get_app_state`
- **Description:** Returns the complete document tree, canvas viewport coordinates, zoom level, and selected node IDs.
- **Input Parameters:**
  - `filePath` (optional string): Path to `.pen` document.
- **Output:** JSON object containing `version`, `children`, `selection`, `viewport`.

### 2. `execute`
- **Description:** Executes design mutations on the `.pen` document via direct JavaScript snippets or surgical find-and-replace patches.
- **Input Parameters:**
  - `filePath` (required string): Path to target `.pen` file.
  - `input` (optional string): JavaScript mutation code targeting the canvas AST API.
  - `description` (optional string): Imperative 3-8 word label describing action (e.g. "Add pricing card").
  - `editId` (optional string): ID of previously failed execution snippet to patch.
  - `edits` (optional array): Surgical `{ find, replace, all? }` text patches for retry.

### 3. `get_style`
- **Description:** Returns all design tokens, typography styles, color palette variables, and theme configurations.
- **Input Parameters:**
  - `filePath` (optional string)

### 4. `browser`
- **Description:** Interacts with integrated headless browser to load real websites, screenshot them, query DOM elements, or convert live DOM nodes into editable canvas layers (`import-to-canvas`).
- **Input Parameters:**
  - `action`: `"load-page" | "import-to-canvas" | "screenshot-to-canvas" | "return-element" | "return-screenshot" | "cdp"`
  - `url` (optional string): Target web URL.
  - `querySelector` (optional string): CSS selector to target specific component.
  - `method`, `params`: Chrome DevTools Protocol commands when action is `cdp`.

### 5. `import_website`
- **Description:** High-level one-step utility to scrape a website URL and append it onto canvas as editable vector frames.
- **Input Parameters:**
  - `filePath`: string
  - `url`: string

### 6. `read_skill`
- **Description:** Exposes design guidelines, responsive rules, spacing standards, and design system instructions to coding agents.

### 7. `spawn_agents`
- **Description:** Launches background multi-agent workers to generate layouts, illustrations, and design variants.
