# Pen.dev UI Redesign & Full Functional Integration

## Goal
Rebuild the web UI to match the exact visual layout and styling of pen.dev from `docs/images/ui-web.png` (macOS chrome header, left Agent prompt & chat panel with Claude Opus selector, vertical floating tool dock, multi-artboard canvas, and bottom-right zoom widget) ensuring all buttons and workflows are fully operational.

## Tasks
- [x] Task 1: **Build macOS Chrome Bar & Top Navigation** (`src/components/layout/WindowChrome.tsx`) with traffic lights, `untitled.pen` tabs, Share, Play/Preview modal, Web import button, and Free plan badge → Verify: Open browser, check top bar matches pen.dev header layout.
- [x] Task 2: **Build Left Agent Chat & Prompt Panel** (`src/components/sidebar/AgentChatPanel.tsx`) with sub-navigation tabs (Agent, Layers, Screens, Components, Code), prompt suggestion pills, and guidance cards → Verify: Click suggestion pills to see them populate the chat input.
- [x] Task 3: **Implement Bottom Chat & Claude Opus Model Selector** (`src/components/sidebar/ChatInputBox.tsx`) with textarea, file attach `+`, speed `1x`, model dropdown (`Claude Opus 4.5`, `Claude 3 Opus`, `Claude 3.5 Sonnet`), and Send button → Verify: Send prompt to trigger live canvas generation via Claude Opus / MCP engine.
- [x] Task 4: **Build Floating Vertical Tool Dock** (`src/components/toolbar/FloatingToolDock.tsx`) containing sidebar toggle, select, frame, shape, text, pen, browser, comments, and component library icons → Verify: Click each tool to toggle tool state and see active highlight.
- [x] Task 5: **Support Multi-Variant Artboard Rendering on Canvas** (`src/components/canvas/InfiniteCanvas.tsx`) showing side-by-side design variants (`1. Neon Glass`, `2. Variant B`, etc.) with titles, responsive cards, and bottom-right zoom widget (`-`, `9%`, `+`) → Verify: Pan and zoom across multiple rendered artboards smoothly.
- [x] Task 6: **Implement Top-Right Play/Preview Fullscreen Mode** (`src/components/modals/PreviewModal.tsx`) allowing interactive preview of generated web variants → Verify: Click Play button in top bar to open interactive preview.
- [x] Task 7: **Integrate Multi-Tab Switching in Left Sidebar** (`src/components/layout/LeftSidebarContainer.tsx`) switching between Agent Chat, Document Layers, Components, and Code Export → Verify: Click sidebar tab icons to verify view transitions cleanly.
- [x] Task 8: **E2E UI & Functional Verification** → Verify: Run `npm test` and `npm run build`, launch `npm run dev`, test full user flow from entering prompt to viewing generated artboards and consulting Claude Opus.

## Done When
- [x] Studio UI pixel-accurately mirrors `/Applications/work/web-creator-ai/docs/images/ui-web.png`.
- [x] All interactive controls work: Agent chat, suggestion pills, model selector, floating tool dock, canvas zoom/pan, play preview, and code export.
- [x] All tests pass (`npm test`) and production build succeeds (`npm run build`).

## Notes
- Theme palette: pen.dev dark theme (`#0c0d12` background, `#16171f` panels, `#232533` borders, `#ff7700`/orange & purple accent colors).
- Keep existing `.pen` AST serializer and MCP server fully connected to the new UI.
