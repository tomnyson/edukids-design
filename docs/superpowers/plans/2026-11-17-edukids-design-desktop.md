# EduKids Design Rebrand and Desktop Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the app to "EduKids Design" with its own logo, and produce an installable macOS desktop app that runs without `npm run dev`.

**Architecture:** One brand module and one logo file feed every visible name and mark. The desktop app is Electron: its main process serves the Vite build from a local HTTP server on a fixed loopback port and mounts the existing Claude CLI bridge middleware on it, so the renderer code and `fetch('/api/claude/...')` calls stay unchanged.

**Tech Stack:** React 19, Vite 6, TypeScript, vitest; new dev dependencies `electron`, `electron-builder`, `esbuild`, `sharp`.

**Spec:** No spec document. The request was: "add logo và name change to edukids design và tạo bản build chạy trên máy tính". Every decision below that the request does not state is the planner's call and is marked so in Decisions.

## Decisions (planner's calls)

- **Electron, not Tauri.** The Claude bridge (`server/claude-bridge-plugin.ts`) is Node code that spawns the `claude` CLI. Electron's main process runs it as is; Tauri would need a Rust port or a Node sidecar.
- **Target: macOS arm64 `.dmg`, unsigned.** That is the machine this is built on. Windows and code signing are out of scope.
- **Logo: an original SVG mark is drawn in Task 1** because the repo has no EduKids logo. The user's own logo replaces `src/assets/brand/logo.svg`; nothing else changes.
- **Visible name only.** `.pen` format code, comments about pen.dev file compatibility, and the localStorage key `pen-studio.agent-chat` stay (renaming the key would drop saved chats).
- **Model picker labels (`pen.dev Pro - …`, group `PEN.DEV`) are left alone.** They are model names with tests and a model-id mapping behind them; flagged for the user at handoff.
- **Fixed port `47615`.** localStorage is per origin, and the origin includes the port: a random port would wipe chat history, API key and recents on every launch.

## Global Constraints

- Product name, exactly: `EduKids Design`. Short name: `EduKids`. MCP server id: `edukids-design`. App id: `com.edukids.design`.
- Desktop server binds `127.0.0.1` only, port `47615`.
- Electron window: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, no preload script.
- Before using any Electron or electron-builder API, check current docs through Context7 (`resolve-library-id` then `query-docs`); do not rely on memory for option names.
- Repo rules: immutable updates, no `console.log` in app code, zod for untrusted input, tests first, files under 800 lines.
- Do not commit. The working tree on `main` holds unrelated uncommitted work; the user commits when ready.
- Test command: `npx vitest run`. Typecheck: `npx tsc -b`. Both must stay clean after every task.

## Review Focus

1. **`claude` is not on the PATH of an app launched from Finder** (GUI apps get `/usr/bin:/bin:/usr/sbin:/sbin`). Expected: the CLI is still found in the usual install folders, and when it is truly missing the app shows its existing "Không tìm thấy Claude CLI" reply instead of failing silently. Tests: Task 3.
2. **Unsaved document and the user closes the window.** The app's `beforeunload` handler makes Electron refuse to close with no dialog at all. Expected: a native "discard changes?" dialog. Owner: Task 5 (`will-prevent-unload`), manual check.
3. **Port 47615 already in use.** Expected: a clear error dialog and exit, never a silent switch to another port (which would hide the user's saved data). Tests: Task 4; dialog in Task 5.
4. **Request path escapes the build folder** (`/../package.json`, encoded `%2e%2e`). Expected: 404, file not served. Tests: Task 4.
5. **A replacement logo that is not square.** Expected: it is shown whole, not stretched or cropped. Test: Task 1.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/brand.ts` (new) | Brand constants; `isDesktopApp()` |
| `src/assets/brand/logo.svg` (new) | The one logo source |
| `src/components/brand/BrandLogo.tsx` (new) | Logo image at a given size |
| `public/favicon.svg` (new) | Browser tab icon (copy of the logo) |
| `desktop/cli-path.ts` (new) | Finds the `claude` binary outside a shell |
| `desktop/app-server.ts` (new) | Static files + bridge on one HTTP server |
| `desktop/main.ts` (new) | Electron entry: server, window, close guard |
| `scripts/build-icon.mjs` (new) | `logo.svg` → `build/icon.png` 1024×1024 |
| `server/claude-bridge-plugin.ts` | Export the middleware; read the CLI path lazily |
| `src/components/layout/WindowChrome.tsx` | Brand; real title-bar area in desktop |
| `index.html`, `README.md`, `TopNavbar.tsx`, `AgentConnectModal.tsx`, `consultant-prompt.ts`, `scripts/setup-mcp-agents.js` | Name strings |
| `package.json`, `tsconfig.json`, `.gitignore` | Scripts, `main`, `build` config, ignores |

---

### Task 1: Brand module, logo and visible name

**Files:**
- Create: `src/lib/brand.ts`, `src/assets/brand/logo.svg`, `src/components/brand/BrandLogo.tsx`, `public/favicon.svg`
- Modify: `index.html:5,7`, `src/components/layout/WindowChrome.tsx:38-44`, `src/components/toolbar/TopNavbar.tsx:80-85`, `src/components/modals/AgentConnectModal.tsx:35,51,83`, `src/advisor/prompts/consultant-prompt.ts:2`, `scripts/setup-mcp-agents.js:10,25,48,66`, `README.md:1,59`, `package.json` (`"name": "edukids-design"`)
- Test: `tests/unit/brand.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export const BRAND: { readonly name: 'EduKids Design'; readonly shortName: 'EduKids';
    readonly tagline: 'AI Design-as-Code Canvas'; readonly mcpServerId: 'edukids-design' };
  export function isDesktopApp(userAgent?: string): boolean; // true when the UA contains "Electron"
  export function BrandLogo(props: { size?: number; className?: string }): JSX.Element; // default size 20
  ```

- [ ] **Step 1: Write the failing tests** in `tests/unit/brand.test.tsx`

```tsx
it('names the product', () => {
  expect(BRAND.name).toBe('EduKids Design');
  expect(BRAND.mcpServerId).toBe('edukids-design');
});
it('detects the desktop shell from the user agent', () => {
  expect(isDesktopApp('Mozilla/5.0 ... Electron/40.0.0 Safari/537.36')).toBe(true);
  expect(isDesktopApp('Mozilla/5.0 ... Chrome/140.0 Safari/537.36')).toBe(false);
});
it('renders the logo whole at the requested size', () => {
  const html = renderToStaticMarkup(<BrandLogo size={28} />);
  expect(html).toContain('alt="EduKids Design"');
  expect(html).toContain('width="28"');
  expect(html).toContain('object-contain');
});
it('leaves no old product name in visible UI', () => {
  const files = ['index.html', 'src/components/layout/WindowChrome.tsx', 'src/components/toolbar/TopNavbar.tsx',
    'src/components/modals/AgentConnectModal.tsx', 'src/advisor/prompts/consultant-prompt.ts', 'scripts/setup-mcp-agents.js'];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    expect(source, file).not.toMatch(/Pen Studio|pen-studio|>pen\.dev</);
  }
  expect(readFileSync('index.html', 'utf8')).toContain('<title>EduKids Design - AI Design-as-Code Canvas</title>');
});
```

- [ ] **Step 2: Run `npx vitest run tests/unit/brand.test.tsx`.** Expected: FAIL, modules not found.
- [ ] **Step 3: Create `src/assets/brand/logo.svg`.** Square `viewBox="0 0 64 64"`, self-contained (no external fonts or images), readable at 16px: a rounded-square badge in a warm orange-to-amber gradient with a simple white pencil-and-star mark. Copy the same file to `public/favicon.svg`.
- [ ] **Step 4: Create `src/lib/brand.ts` and `BrandLogo.tsx`.** `BrandLogo` imports the SVG as a URL (`import logoUrl from '../../assets/brand/logo.svg'`) and renders `<img src width height alt={BRAND.name} className="object-contain …" draggable={false} />`. Add `declare module '*.svg'` to a `src/vite-env.d.ts` if the import does not typecheck.
- [ ] **Step 5: Replace the names.**
  - `index.html`: icon `href="/favicon.svg"`, title as in the test.
  - `WindowChrome.tsx`: the orange "P" square becomes `<BrandLogo size={20} />`; the label becomes `{BRAND.name}`.
  - `TopNavbar.tsx`: `PenTool` badge becomes `<BrandLogo size={28} />`; label `{BRAND.name}`.
  - `AgentConnectModal.tsx`, `setup-mcp-agents.js`, `README.md`: `pen-studio` → `edukids-design`, "Pen Studio" → "EduKids Design".
  - `consultant-prompt.ts`: "Pen Studio" → "EduKids Design".
- [ ] **Step 6: Run `npx vitest run && npx tsc -b`.** Expected: all pass, no type errors.
- [ ] **Step 7: Check in the browser.** `npm run dev`, open `http://localhost:5173`: tab title and icon, and the top-left logo and name, show EduKids Design.

### Task 2: Window chrome that fits a real desktop window

**Files:**
- Modify: `src/components/layout/WindowChrome.tsx:28-36`
- Test: `tests/unit/brand.test.tsx` (extend)

**Interfaces:**
- Consumes: `isDesktopApp()` from Task 1.
- Produces: `export function TitleBarLead(props: { desktop: boolean }): JSX.Element` in `WindowChrome.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
it('draws fake window buttons only in the browser', () => {
  const web = renderToStaticMarkup(<TitleBarLead desktop={false} />);
  const desktop = renderToStaticMarkup(<TitleBarLead desktop />);
  expect(web.match(/rounded-full/g)).toHaveLength(3);
  expect(desktop).not.toContain('rounded-full');
  expect(desktop).toContain('width:68px'); // room for the native traffic lights
});
```

- [ ] **Step 2: Run it.** Expected: FAIL, `TitleBarLead` not exported.
- [ ] **Step 3: Implement.** Move the three coloured dots into `TitleBarLead`; with `desktop` it renders an empty 68px-wide spacer instead. In `WindowChrome`, when `isDesktopApp()`: the `<header>` gets `style={{ WebkitAppRegion: 'drag' }}`, and each interactive child group (file menu, tab bar, right-side actions) gets `WebkitAppRegion: 'no-drag'` so clicks still work.
- [ ] **Step 4: Run `npx vitest run && npx tsc -b`.** Expected: pass.

### Task 3: Bridge usable outside Vite, and finding `claude` without a shell

**Files:**
- Create: `desktop/cli-path.ts`
- Modify: `server/claude-bridge-plugin.ts:15,68,87,135`, `tsconfig.json` (`"include"` adds `"desktop"`)
- Test: `tests/unit/desktop-cli-path.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // server/claude-bridge-plugin.ts
  export const bridgeMiddleware: Connect.NextHandleFunction; // was module-private
  export function claudeBin(): string; // process.env.CLAUDE_CLI_PATH || 'claude', read on every call

  // desktop/cli-path.ts
  export interface CliPathEnv { CLAUDE_CLI_PATH?: string; PATH?: string; HOME?: string }
  /** Folders a GUI-launched app must search, after PATH */
  export function candidateDirs(env: CliPathEnv): string[];
  /** Absolute path of the claude binary, or null when it is not installed */
  export function resolveClaudeBin(env: CliPathEnv, isExecutable: (path: string) => boolean): string | null;
  /** PATH extended with candidateDirs, without duplicates, original order first */
  export function extendedPath(env: CliPathEnv): string;
  ```
- `candidateDirs` returns, in order: each `PATH` entry, then `$HOME/.local/bin`, `$HOME/.claude/local`, `/opt/homebrew/bin`, `/usr/local/bin`.

- [ ] **Step 1: Write the failing tests**

```ts
const env = { PATH: '/usr/bin:/bin', HOME: '/Users/kid' };
it('prefers an explicit CLAUDE_CLI_PATH', () => {
  expect(resolveClaudeBin({ ...env, CLAUDE_CLI_PATH: '/x/claude' }, () => true)).toBe('/x/claude');
});
it('finds claude in a user install folder that a Finder launch has no PATH for', () => {
  const found = resolveClaudeBin(env, (p) => p === '/Users/kid/.local/bin/claude');
  expect(found).toBe('/Users/kid/.local/bin/claude');
});
it('searches PATH before the fallback folders', () => {
  expect(resolveClaudeBin(env, (p) => p === '/usr/bin/claude' || p === '/opt/homebrew/bin/claude')).toBe('/usr/bin/claude');
});
it('returns null when claude is not installed', () => {
  expect(resolveClaudeBin(env, () => false)).toBeNull();
});
it('extends PATH without duplicating entries', () => {
  expect(extendedPath({ PATH: '/usr/bin:/opt/homebrew/bin', HOME: '/Users/kid' }))
    .toBe('/usr/bin:/opt/homebrew/bin:/Users/kid/.local/bin:/Users/kid/.claude/local:/usr/local/bin');
});
it('reads the CLI path at call time', () => {
  process.env.CLAUDE_CLI_PATH = '/late/claude';
  expect(claudeBin()).toBe('/late/claude');
  delete process.env.CLAUDE_CLI_PATH;
  expect(claudeBin()).toBe('claude');
});
```

- [ ] **Step 2: Run `npx vitest run tests/unit/desktop-cli-path.test.ts`.** Expected: FAIL, module not found.
- [ ] **Step 3: Implement `desktop/cli-path.ts`** as pure functions (no `fs` import; the caller passes `isExecutable`).
- [ ] **Step 4: Edit the bridge.** Replace the `CLAUDE_BIN` constant with `claudeBin()` at both call sites; add `export` to `bridgeMiddleware`. No behaviour change under Vite.
- [ ] **Step 5: Run `npx vitest run && npx tsc -b`.** Expected: pass, including the existing `claude-cli.test.ts`.

### Task 4: Local app server

**Files:**
- Create: `desktop/app-server.ts`
- Test: `tests/unit/desktop-app-server.test.ts`

**Interfaces:**
- Consumes: a middleware of type `(req, res, next) => void` (the bridge in production, a stub in tests).
- Produces:
  ```ts
  export const DESKTOP_HOST = '127.0.0.1';
  export const DESKTOP_PORT = 47615;
  export interface AppServerOptions { distDir: string; bridge: Connect.NextHandleFunction; port?: number }
  /** Resolves with the listening server; rejects with the listen error (e.g. code 'EADDRINUSE') */
  export function startAppServer(options: AppServerOptions): Promise<http.Server>;
  ```
- Behaviour: every request goes to `bridge` first; when it calls `next()`, the request is served from `distDir`. `GET`/`HEAD` only (else 405). `/` and any path without a file extension return `index.html`. A path with an extension that does not exist returns 404. The resolved file path must stay inside `distDir`, checked after `decodeURIComponent` and `path.resolve`; otherwise 404. Content types: `.html .js .css .svg .png .jpg .webp .woff2 .json .ico .map`; anything else `application/octet-stream`. `index.html` is sent with `Cache-Control: no-cache`.

- [ ] **Step 1: Write the failing tests.** Each test builds a temp `distDir` (`index.html`, `assets/app.js`, `favicon.svg`), starts the server with `port: 0`, and uses `fetch`.

```ts
it('serves index.html at the root', ...)            // 200, text/html, body is the file
it('serves assets with their content type', ...)    // /assets/app.js → text/javascript
it('falls back to index.html for app routes', ...)  // /some/route → 200 index.html
it('returns 404 for a missing asset', ...)          // /assets/nope.js → 404
it('never serves files outside the build folder', async () => {
  // a secret.txt sits next to distDir
  for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/assets/..%2f..%2fsecret.txt']) {
    const res = await rawGet(port, path); // raw http.request: fetch would normalise the dots away
    expect(res.status, path).toBe(404);
    expect(res.body).not.toContain('TOP SECRET');
  }
});
it('gives the bridge first refusal', ...)           // stub answers /api/claude/status with {available:true}
it('rejects other methods', ...)                    // POST /index.html → 405 (stub calls next)
it('listens on loopback only', ...)                 // server.address().address === '127.0.0.1'
it('rejects when the port is taken', async () => {
  const first = await startAppServer({ distDir, bridge: pass, port: 0 });
  const port = (first.address() as AddressInfo).port;
  await expect(startAppServer({ distDir, bridge: pass, port })).rejects.toMatchObject({ code: 'EADDRINUSE' });
});
```

- [ ] **Step 2: Run `npx vitest run tests/unit/desktop-app-server.test.ts`.** Expected: FAIL, module not found.
- [ ] **Step 3: Implement `startAppServer`** with `node:http`, `node:fs`, `node:path` only (no new runtime dependency). Stream files with `fs.createReadStream`; on a stream error respond 404 if headers are not sent.
- [ ] **Step 4: Run `npx vitest run && npx tsc -b`.** Expected: pass.

### Task 5: Electron shell, icon and packaging

**Files:**
- Create: `desktop/main.ts`, `scripts/build-icon.mjs`
- Modify: `package.json`, `.gitignore` (add `dist-desktop`, `release`, `build`)

**Interfaces:**
- Consumes: `startAppServer`, `DESKTOP_HOST`, `DESKTOP_PORT` (Task 4); `resolveClaudeBin`, `extendedPath` (Task 3); `bridgeMiddleware` (Task 3); `src/assets/brand/logo.svg` (Task 1).
- Produces: `release/EduKids Design-1.0.0-arm64.dmg`.

- [ ] **Step 1: Install tooling.** `npm install -D electron electron-builder esbuild sharp`. Then read the Electron and electron-builder docs through Context7 for: `BrowserWindow` options, `will-prevent-unload`, `setWindowOpenHandler`, `requestSingleInstanceLock`, and the `build` config keys used below.
- [ ] **Step 2: Write `scripts/build-icon.mjs`.** With `sharp`, render `src/assets/brand/logo.svg` to `build/icon.png` at 1024×1024 on a transparent background, creating `build/` if needed. Exit non-zero with a message if the SVG is missing.
- [ ] **Step 3: Write `desktop/main.ts`.** In order:
  1. `app.requestSingleInstanceLock()`; if not obtained, `app.quit()`. On `second-instance`, restore and focus the existing window.
  2. Before starting the server: set `process.env.PATH = extendedPath(process.env)`; if `resolveClaudeBin(process.env, isExecutable)` returns a path, set `process.env.CLAUDE_CLI_PATH` to it. `isExecutable` uses `fs.accessSync(path, fs.constants.X_OK)`. A null result is not an error: the app then reports the missing CLI in chat as it does today.
  3. `startAppServer({ distDir: path.join(app.getAppPath(), 'dist'), bridge: bridgeMiddleware })`. On rejection: `dialog.showErrorBox('EduKids Design', …)` naming port 47615 when `code === 'EADDRINUSE'`, then `app.exit(1)`.
  4. Window: 1440×900, `minWidth: 1024`, `minHeight: 640`, `title: 'EduKids Design'`, `backgroundColor: '#0c0d12'`, `titleBarStyle: 'hiddenInset'`, `trafficLightPosition: { x: 14, y: 14 }`, the `webPreferences` from Global Constraints. Load `http://127.0.0.1:47615/`.
  5. `setWindowOpenHandler`: `http:`/`https:` URLs go to `shell.openExternal`; always return `{ action: 'deny' }`. `will-navigate` away from the app origin: `preventDefault()` and open externally under the same rule.
  6. `will-prevent-unload`: `dialog.showMessageBoxSync` with buttons `['Ở lại', 'Đóng không lưu']`, default and cancel on index 0, message "Thiết kế có thay đổi chưa lưu."; call `event.preventDefault()` only when the user picks index 1 (in Electron that lets the close go ahead).
  7. `window-all-closed`: close the server, then `app.quit()` (on macOS too; this is a single-window app).
- [ ] **Step 4: Edit `package.json`.**
  - `"main": "dist-desktop/main.cjs"`, `"description": "EduKids Design"`, `"author": "EduKids"`.
  - Scripts:
    ```json
    "desktop:main": "esbuild desktop/main.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-desktop/main.cjs",
    "desktop:icon": "node scripts/build-icon.mjs",
    "desktop:dev": "npm run build && npm run desktop:main && electron .",
    "desktop:dist": "npm run build && npm run desktop:icon && npm run desktop:main && electron-builder --mac dmg --arm64"
    ```
  - `"build"`: `appId: "com.edukids.design"`, `productName: "EduKids Design"`, `directories: { output: "release", buildResources: "build" }`, `files: ["dist/**", "dist-desktop/**", "package.json"]`, `mac: { category: "public.app-category.graphics-design", icon: "build/icon.png", identity: null }`. Confirm each key against the docs read in Step 1.
- [ ] **Step 5: Run `npx vitest run && npx tsc -b`.** Expected: pass (`desktop/main.ts` typechecks against Electron's bundled types).
- [ ] **Step 6: Run `npm run desktop:dev` and check by hand.**
  - The window opens with native traffic lights, no fake dots, and the EduKids logo and name; dragging the title bar moves the window and the File menu, tabs and Share still click.
  - The chat model status finds the Claude CLI (send one 1x prompt; a frame arrives).
  - Draw a rectangle, press ⌘W: the "Thiết kế có thay đổi chưa lưu." dialog appears; "Ở lại" keeps the window, "Đóng không lưu" closes it.
  - File → Save As… opens a native save dialog and writes a `.pen` file.
  - Launch a second copy: the first window comes to the front and no second window opens.
  - Quit, relaunch: the earlier chat is still in the history menu.
- [ ] **Step 7: Run `npm run desktop:dist`.** Expected: `release/EduKids Design-1.0.0-arm64.dmg` exists. Open it, drag the app to Applications, launch it from Finder (not the terminal) and repeat the CLI check from Step 6; this is the launch that has no shell PATH.

## Known limits (not fixed here)

- The app carries an ad-hoc signature only (`mac.identity: "-"`), with no Developer ID and no notarization. It runs on the Mac that built it. On another Mac, Gatekeeper blocks a downloaded copy; `xattr -cr "/Applications/EduKids Design.app"` clears the quarantine flag. Sharing it properly needs a Developer ID certificate and notarization.
- "Share" links are built from the page origin, so links made in the desktop app point at `http://127.0.0.1:47615` and only open on the same machine.
- Design generation still needs Claude Code installed and logged in on the machine, or an Anthropic API key entered in the app.
