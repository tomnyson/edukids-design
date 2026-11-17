import { create } from 'zustand';
import { PenDocument, PenNode, FrameNode } from '../types/pen-ast';
import { generateNodeId, findNodeById, updateNodeInTree } from '../core/io/pen-file-handler';
import {
  DocTab,
  HistorySnapshot,
  Viewport,
  DEFAULT_VIEWPORT,
  createTab,
  uniqueUntitledName,
  snapshotActiveTab,
  activateTab,
  isPristine,
} from './document-tabs';
import { placeDesigns } from '../generator/design-generator';
import {
  CanvasTool,
  PASTE_OFFSET,
  appendToParent,
  cloneWithNewIds,
  findParentId,
  topmostSelected,
} from '../lib/canvas-editing';
import {
  Point,
  WrapKind,
  ZOrder,
  arrangeAsFlex,
  placeAt,
  reorderInParent,
  replaceNode,
  unwrapFrames,
  wrapNodes,
} from '../lib/node-ops';
import {
  createInstance,
  detachOrphans,
  expandInstances,
  findMaster,
  instancesFit,
  resolveInstance,
  wouldNest,
} from '../lib/components';

export type ToolType = CanvasTool;

/** Where a new instance goes: its top-left inside `parentId` (top level without one) */
export interface InstancePlacement extends Point {
  parentId?: string;
}

/** Copied node and the parent it came from, so a paste lands next to the original */
export interface ClipboardEntry {
  node: PenNode;
  parentId: string | null;
  /** `node` with its instances replaced by their content, pasted where those instances cannot go */
  expanded?: PenNode;
}

/** The clipboard node to paste inside `parentId`: the expanded copy when its instances cannot go there */
function pasteSource(entry: ClipboardEntry, docNodes: PenNode[], parentId: string | null): PenNode {
  return entry.expanded && !instancesFit(entry.node, docNodes, parentId) ? entry.expanded : entry.node;
}
export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'very_high';

export type AppView = 'home' | 'editor';

export interface ContextAttachment {
  id: string;
  type: 'image' | 'file' | 'style' | 'skill';
  name: string;
  previewUrl?: string;
  content?: string;
}

interface DesignState {
  // Open documents (the active one is mirrored into the fields below)
  tabs: DocTab[];
  activeTabId: string;

  // Document state
  documentName: string;
  document: PenDocument;
  selectedNodeIds: string[];
  hoveredNodeId: string | null;
  isDirty: boolean;
  fileHandle: FileSystemFileHandle | null;

  // Viewport transformation
  viewport: Viewport;
  activeTool: ToolType;
  clipboard: ClipboardEntry[];

  // Context Attachments & Parallel AI Engine
  contextAttachments: ContextAttachment[];
  parallelAgentsCount: number;
  parallelMode: 'split' | 'side-by-side';
  reasoningEffort: ReasoningEffort;
  selectedModel: string;

  // Context & Parallel Actions
  addContextAttachment: (attachment: ContextAttachment) => void;
  removeContextAttachment: (id: string) => void;
  clearContextAttachments: () => void;
  setParallelConfig: (count: number, mode?: 'split' | 'side-by-side') => void;
  setReasoningEffort: (effort: ReasoningEffort) => void;
  setSelectedModel: (model: string) => void;

  // History stack for undo/redo
  history: HistorySnapshot[];
  historyIndex: number;

  // Actions
  createNewDocument: () => void;
  /** Home screen or the editor (canvas, panels) for the active tab */
  view: AppView;
  showHome: () => void;
  /** Opens a blank tab for a new design (reusing an untouched one) and returns its id */
  startBlankDesign: () => string;
  setDocumentName: (name: string) => void;
  loadDocument: (doc: PenDocument, name?: string, fileHandle?: FileSystemFileHandle | null) => void;
  switchTab: (id: string) => void;
  closeTab: (id: string) => void;
  markSaved: (
    tabId: string,
    name: string,
    fileHandle: FileSystemFileHandle | null,
    savedDocument: PenDocument
  ) => void;
  selectNode: (id: string | null, multi?: boolean) => void;
  hoverNode: (id: string | null) => void;
  setViewport: (x: number, y: number, zoom?: number) => void;
  setActiveTool: (tool: ToolType) => void;

  // Node Mutations
  addNode: (node: Partial<PenNode>, parentId?: string) => string;
  updateNode: (id: string, patch: Partial<PenNode>) => void;
  deleteSelectedNodes: () => void;
  moveNode: (id: string, dx: number, dy: number) => void;
  /** Moves several nodes as one undo step */
  moveNodes: (ids: string[], dx: number, dy: number) => void;
  selectAll: () => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  duplicateSelection: () => void;

  // Context menu actions; each is one undo step and a no-op when nothing applies
  reorderSelection: (order: ZOrder) => void;
  /** False when the selection is empty or spans different parents */
  groupSelection: (kind: WrapKind) => boolean;
  ungroupSelection: () => void;
  addFlexLayout: () => void;
  removeFlexLayout: () => void;
  flipSelection: (axis: 'x' | 'y') => void;
  /** Pastes the clipboard with its top-left at `point`, inside `parentId` (top level for null) */
  pasteAt: (parentId: string | null, point: Point) => void;
  /** Swaps the single selected node for the clipboard contents */
  pasteToReplace: () => void;

  // Components
  /** Marks the selected frame as a master, or wraps the selection in a new master frame */
  createComponent: () => void;
  /** Adds an instance of `masterId` and selects it; null when the master is missing or would contain itself */
  insertInstance: (masterId: string, placement: InstancePlacement) => string | null;
  /** Replaces each selected instance with a plain copy of what it shows */
  detachSelection: () => void;

  // Text-to-design: appends AI output to the tab that requested it (false if it was closed)
  appendGeneratedDesigns: (tabId: string, designs: FrameNode[], direction: 'row' | 'column') => boolean;
  /** Appends frames that already carry their final position, as one undo step; false when the tab is gone */
  appendPlacedFrames: (tabId: string, frames: FrameNode[]) => boolean;

  // Autonomous Advisor Co-pilot State
  isAutoAdvisorEnabled: boolean;
  isAutonomousModeEnabled: boolean;
  toastMessage: string | null;
  toggleAutoAdvisor: () => void;
  toggleAutonomousMode: () => void;
  setToastMessage: (msg: string | null) => void;
  applyAutonomousPatches: (critiques: any[]) => number;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
}

export const BLANK_PEN_DOC: PenDocument = {
  version: '2.13',
  children: [], // Completely blank canvas - no pre-generated frames
  themes: {
    Mode: ['Light', 'Dark'],
  },
  variables: {
    '--background': {
      type: 'color',
      value: '#0c0d12',
    },
    '--primary': {
      type: 'color',
      value: '#38bdf8',
    },
  },
};

const DEFAULT_PEN_DOC: PenDocument = BLANK_PEN_DOC;

/** Topmost selected nodes that are frames */
function selectedFrames(state: DesignState): FrameNode[] {
  const { document: doc, selectedNodeIds } = state;
  return topmostSelected(doc.children, selectedNodeIds).flatMap((id) => {
    const node = findNodeById(doc.children, id);
    return node?.type === 'frame' ? [node] : [];
  });
}

function pushHistory(state: DesignState, edited: PenDocument) {
  // An edit that removed a master leaves its instances as plain copies, not blanks
  const children = detachOrphans(state.document.children, edited.children, generateNodeId);
  const newDoc = children === edited.children ? edited : { ...edited, children };
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push({ document: JSON.parse(JSON.stringify(newDoc)) });
  return {
    document: newDoc,
    history: newHistory,
    historyIndex: newHistory.length - 1,
    isDirty: true,
  };
}

const INITIAL_TAB = createTab(DEFAULT_PEN_DOC, 'untitled.pen');

export const useDesignStore = create<DesignState>((set, get) => ({
  tabs: [INITIAL_TAB],
  ...activateTab(INITIAL_TAB),
  view: 'home',
  activeTool: 'select',
  clipboard: [],

  // Context Attachments & Parallel AI Engine State
  contextAttachments: [],
  parallelAgentsCount: 1,
  parallelMode: 'side-by-side',
  reasoningEffort: 'medium',
  selectedModel: 'Claude Opus 5.5',

  addContextAttachment: (attachment) => {
    set((state) => ({
      contextAttachments: [
        ...state.contextAttachments.filter((a) => a.id !== attachment.id),
        attachment,
      ],
      toastMessage: `📎 Đã gắn context: "${attachment.name}"`,
    }));
    setTimeout(() => {
      if (get().toastMessage?.includes('context')) {
        set({ toastMessage: null });
      }
    }, 3000);
  },

  removeContextAttachment: (id) =>
    set((state) => ({
      contextAttachments: state.contextAttachments.filter((a) => a.id !== id),
    })),

  clearContextAttachments: () => set({ contextAttachments: [] }),

  setParallelConfig: (count, mode) =>
    set((state) => ({
      parallelAgentsCount: count,
      parallelMode: mode || state.parallelMode,
      toastMessage: `⚡ Đã chọn ${count}x Parallel Agents (${(mode || state.parallelMode) === 'split' ? 'Split Work' : 'Side by Side'})`,
    })),

  setReasoningEffort: (effort) =>
    set({
      reasoningEffort: effort,
      toastMessage: `🧠 Reasoning Effort: ${effort.toUpperCase()}`,
    }),

  setSelectedModel: (model) => set({ selectedModel: model }),

  // Autonomous Advisor Co-pilot default state
  isAutoAdvisorEnabled: true,
  isAutonomousModeEnabled: true,
  toastMessage: null,

  toggleAutoAdvisor: () =>
    set((state) => ({ isAutoAdvisorEnabled: !state.isAutoAdvisorEnabled })),

  toggleAutonomousMode: () =>
    set((state) => ({ isAutonomousModeEnabled: !state.isAutonomousModeEnabled })),

  setToastMessage: (msg) => set({ toastMessage: msg }),

  applyAutonomousPatches: (critiques) => {
    const patches = critiques.filter(
      (c) => c.suggestedPatch && (c.severity === 'critical' || c.severity === 'warning')
    );
    if (patches.length === 0) return 0;

    let currentDoc = get().document;
    for (const crit of patches) {
      if (crit.suggestedPatch) {
        currentDoc = {
          ...currentDoc,
          children: updateNodeInTree(
            currentDoc.children,
            crit.suggestedPatch.nodeId,
            crit.suggestedPatch.patch
          ),
        };
      }
    }

    set(pushHistory(get(), currentDoc));
    set({
      toastMessage: `🤖 Advisor tự động áp dụng ${patches.length} cải tiến thiết kế (Touch target & Grid). Nhấn Cmd+Z để hoàn tác.`,
    });

    // Auto dismiss toast after 4s
    setTimeout(() => {
      if (get().toastMessage) {
        set({ toastMessage: null });
      }
    }, 4000);

    return patches.length;
  },

  setDocumentName: (name: string) => set({ documentName: name }),

  showHome: () => set({ view: 'home' }),

  startBlankDesign: () => {
    if (isPristine(get())) {
      set({ view: 'editor' });
    } else {
      // Unlike File > New, the context the user attached on Home belongs to this design
      const { contextAttachments } = get();
      get().createNewDocument();
      set({ contextAttachments });
    }
    return get().activeTabId;
  },

  createNewDocument: () => {
    const state = get();
    const tabs = snapshotActiveTab(state.tabs, state);
    const tab = createTab(BLANK_PEN_DOC, uniqueUntitledName(tabs.map((t) => t.name)));
    set({
      tabs: [...tabs, tab],
      ...activateTab(tab),
      view: 'editor',
      contextAttachments: [],
      toastMessage: `✨ Đã tạo tab mới ${tab.name} (Canvas trống, không có frame).`,
    });
    setTimeout(() => {
      if (get().toastMessage?.includes('tab mới')) {
        set({ toastMessage: null });
      }
    }, 2500);
  },

  loadDocument: (doc, name, fileHandle = null) => {
    const state = get();
    const tabs = snapshotActiveTab(state.tabs, state);
    const tab = createTab(doc, name || uniqueUntitledName(tabs.map((t) => t.name)), fileHandle);
    // Reuse an untouched empty tab rather than piling up blank ones
    const nextTabs = isPristine(state)
      ? tabs.map((t) => (t.id === state.activeTabId ? tab : t))
      : [...tabs, tab];
    set({
      tabs: nextTabs,
      ...activateTab(tab),
      view: 'editor',
      toastMessage: `📂 Đã mở tài liệu ${tab.name}`,
    });
    setTimeout(() => {
      if (get().toastMessage?.includes('Đã mở')) {
        set({ toastMessage: null });
      }
    }, 2500);
  },

  switchTab: (id) => {
    const state = get();
    if (id === state.activeTabId) {
      set({ view: 'editor' });
      return;
    }
    const tabs = snapshotActiveTab(state.tabs, state);
    const target = tabs.find((t) => t.id === id);
    if (!target) return;
    set({ tabs, ...activateTab(target), view: 'editor' });
  },

  closeTab: (id) => {
    const state = get();
    const tabs = snapshotActiveTab(state.tabs, state);
    const index = tabs.findIndex((t) => t.id === id);
    if (index === -1) return;
    const remaining = tabs.filter((t) => t.id !== id);

    if (remaining.length === 0) {
      const blank = createTab(BLANK_PEN_DOC, 'untitled.pen');
      set({ tabs: [blank], ...activateTab(blank) });
      return;
    }
    if (id !== state.activeTabId) {
      set({ tabs: remaining });
      return;
    }
    const neighbour = remaining[Math.min(index, remaining.length - 1)];
    set({ tabs: remaining, ...activateTab(neighbour) });
  },

  markSaved: (tabId, name, fileHandle, savedDocument) => {
    // Saving is async: the user may have edited or switched tabs meanwhile
    const state = get();
    if (tabId === state.activeTabId) {
      const patch = { documentName: name, fileHandle, isDirty: state.document !== savedDocument };
      set({ ...patch, tabs: snapshotActiveTab(state.tabs, { ...state, ...patch }) });
      return;
    }
    set({
      tabs: state.tabs.map((t) =>
        t.id === tabId
          ? { ...t, name, fileHandle, isDirty: t.document !== savedDocument }
          : t
      ),
    });
  },

  selectNode: (id, multi = false) => {
    if (!id) {
      set({ selectedNodeIds: [] });
      return;
    }
    const current = get().selectedNodeIds;
    if (multi) {
      if (current.includes(id)) {
        set({ selectedNodeIds: current.filter((item) => item !== id) });
      } else {
        set({ selectedNodeIds: [...current, id] });
      }
    } else {
      set({ selectedNodeIds: [id] });
    }
  },

  hoverNode: (id) => set({ hoveredNodeId: id }),

  setViewport: (x, y, zoom) =>
    set((state) => ({
      viewport: {
        x,
        y,
        zoom: zoom !== undefined ? Math.max(0.05, Math.min(5, zoom)) : state.viewport.zoom,
      },
    })),

  setActiveTool: (tool) => set({ activeTool: tool }),

  addNode: (partialNode, parentId) => {
    const id = partialNode.id || generateNodeId();
    const nodeType = partialNode.type || 'rect';
    const newNode: PenNode = {
      id,
      type: nodeType,
      name: partialNode.name || `${nodeType.toUpperCase()}-${id}`,
      x: partialNode.x ?? 100,
      y: partialNode.y ?? 100,
      width: partialNode.width ?? 120,
      height: partialNode.height ?? 80,
      fill: partialNode.fill ?? '#27272a',
      stroke: partialNode.stroke,
      strokeWidth: partialNode.strokeWidth,
      cornerRadius: partialNode.cornerRadius,
      ...(nodeType === 'frame' ? { layout: 'none', children: [] } : {}),
      ...(nodeType === 'text' ? { content: 'New Text', fontSize: 16, fill: '#f4f4f5' } : {}),
      ...partialNode,
    } as PenNode;

    const currentDoc = get().document;
    let newChildren: PenNode[];

    if (parentId) {
      const parent = findNodeById(currentDoc.children, parentId);
      if (parent && 'children' in parent) {
        newChildren = updateNodeInTree(currentDoc.children, parentId, {
          children: [...(parent.children || []), newNode],
        });
      } else {
        newChildren = [...currentDoc.children, newNode];
      }
    } else {
      newChildren = [...currentDoc.children, newNode];
    }

    const newDoc = { ...currentDoc, children: newChildren };
    set(pushHistory(get(), newDoc));
    set({ selectedNodeIds: [id] });
    return id;
  },

  updateNode: (id, patch) => {
    const currentDoc = get().document;
    const newChildren = updateNodeInTree(currentDoc.children, id, patch);
    const newDoc = { ...currentDoc, children: newChildren };
    set(pushHistory(get(), newDoc));
  },

  deleteSelectedNodes: () => {
    const { document: doc, selectedNodeIds } = get();
    if (selectedNodeIds.length === 0) return;

    function filterOut(nodes: PenNode[]): PenNode[] {
      return nodes
        .filter((n) => !selectedNodeIds.includes(n.id))
        .map((n) => {
          if ('children' in n && n.children) {
            return { ...n, children: filterOut(n.children) };
          }
          return n;
        });
    }

    const newDoc = { ...doc, children: filterOut(doc.children) };
    set(pushHistory(get(), newDoc));
    set({ selectedNodeIds: [] });
  },

  moveNode: (id, dx, dy) => {
    const current = findNodeById(get().document.children, id);
    if (!current) return;
    get().updateNode(id, {
      x: Math.round((current.x || 0) + dx),
      y: Math.round((current.y || 0) + dy),
    });
  },

  moveNodes: (ids, dx, dy) => {
    if (ids.length === 0 || (dx === 0 && dy === 0)) return;
    const currentDoc = get().document;
    // A node inside another moved node already travels with its parent
    const children = topmostSelected(currentDoc.children, ids).reduce((nodes, id) => {
      const node = findNodeById(nodes, id);
      if (!node) return nodes;
      return updateNodeInTree(nodes, id, {
        x: Math.round((node.x || 0) + dx),
        y: Math.round((node.y || 0) + dy),
      });
    }, currentDoc.children);
    set(pushHistory(get(), { ...currentDoc, children }));
  },

  selectAll: () => set({ selectedNodeIds: get().document.children.map((n) => n.id) }),

  copySelection: () => {
    const { document: doc, selectedNodeIds } = get();
    const entries = topmostSelected(doc.children, selectedNodeIds).flatMap((id) => {
      const node = findNodeById(doc.children, id);
      if (!node) return [];
      const [expanded] = expandInstances([node], doc.children);
      return [{ node, parentId: findParentId(doc.children, id) ?? null, expanded }];
    });
    if (entries.length > 0) set({ clipboard: entries });
  },

  pasteClipboard: () => {
    const { clipboard, document: doc } = get();
    if (clipboard.length === 0) return;
    // Each paste lands one offset further, so repeated pastes do not stack exactly
    const shift = (node: PenNode) =>
      ({ ...node, x: (node.x || 0) + PASTE_OFFSET, y: (node.y || 0) + PASTE_OFFSET }) as PenNode;
    const shifted = clipboard.map((entry) => ({
      ...entry,
      node: shift(entry.node),
      expanded: entry.expanded && shift(entry.expanded),
    }));
    const pasted = shifted.map((entry) => {
      const parentId = entry.parentId && findNodeById(doc.children, entry.parentId) ? entry.parentId : null;
      return { parentId, node: cloneWithNewIds(pasteSource(entry, doc.children, parentId), generateNodeId) };
    });
    const children = pasted.reduce((nodes, entry) => appendToParent(nodes, entry.parentId, entry.node), doc.children);
    set(pushHistory(get(), { ...doc, children }));
    set({ clipboard: shifted, selectedNodeIds: pasted.map((entry) => entry.node.id) });
  },

  duplicateSelection: () => {
    const { document: doc, selectedNodeIds } = get();
    const copies = topmostSelected(doc.children, selectedNodeIds).flatMap((id) => {
      const node = findNodeById(doc.children, id);
      if (!node) return [];
      const moved = { ...node, x: (node.x || 0) + PASTE_OFFSET, y: (node.y || 0) + PASTE_OFFSET } as PenNode;
      return [{ parentId: findParentId(doc.children, id) ?? null, node: cloneWithNewIds(moved, generateNodeId) }];
    });
    if (copies.length === 0) return;
    const children = copies.reduce((nodes, entry) => appendToParent(nodes, entry.parentId, entry.node), doc.children);
    set(pushHistory(get(), { ...doc, children }));
    set({ selectedNodeIds: copies.map((entry) => entry.node.id) });
  },

  reorderSelection: (order) => {
    const { document: doc, selectedNodeIds } = get();
    const ids = topmostSelected(doc.children, selectedNodeIds);
    if (ids.length === 0) return;
    set(pushHistory(get(), { ...doc, children: reorderInParent(doc.children, ids, order) }));
  },

  groupSelection: (kind) => {
    const { document: doc, selectedNodeIds } = get();
    const wrapperId = generateNodeId();
    const children = wrapNodes(doc.children, topmostSelected(doc.children, selectedNodeIds), kind, wrapperId);
    if (!children) return false;
    set(pushHistory(get(), { ...doc, children }));
    set({ selectedNodeIds: [wrapperId] });
    return true;
  },

  ungroupSelection: () => {
    const { document: doc, selectedNodeIds } = get();
    const { nodes, liftedIds } = unwrapFrames(doc.children, topmostSelected(doc.children, selectedNodeIds));
    if (liftedIds.length === 0) return;
    set(pushHistory(get(), { ...doc, children: nodes }));
    set({ selectedNodeIds: liftedIds });
  },

  addFlexLayout: () => {
    const { document: doc } = get();
    const frames = selectedFrames(get()).filter((f) => f.children.length > 0 && f.layout !== 'flex');
    if (frames.length === 0) return;
    const children = frames.reduce((nodes, frame) => updateNodeInTree(nodes, frame.id, arrangeAsFlex(frame)), doc.children);
    set(pushHistory(get(), { ...doc, children }));
  },

  removeFlexLayout: () => {
    const { document: doc } = get();
    // Children already sit where flex put them (addFlexLayout bakes positions), so they stay put
    const frames = selectedFrames(get()).filter((f) => f.layout === 'flex');
    if (frames.length === 0) return;
    const children = frames.reduce((nodes, frame) => updateNodeInTree(nodes, frame.id, { layout: 'none' }), doc.children);
    set(pushHistory(get(), { ...doc, children }));
  },

  flipSelection: (axis) => {
    const { document: doc, selectedNodeIds } = get();
    const field = axis === 'x' ? 'flipX' : 'flipY';
    const nodes = topmostSelected(doc.children, selectedNodeIds).flatMap((id) => findNodeById(doc.children, id) ?? []);
    if (nodes.length === 0) return;
    const children = nodes.reduce((tree, node) => updateNodeInTree(tree, node.id, { [field]: !node[field] }), doc.children);
    set(pushHistory(get(), { ...doc, children }));
  },

  pasteAt: (parentId, point) => {
    const { clipboard, document: doc } = get();
    if (clipboard.length === 0) return;
    // A parent that is gone (or cannot hold children) falls back to the top level
    const parent = parentId ? findNodeById(doc.children, parentId) : null;
    const target = parent && 'children' in parent && parent.children ? parent.id : null;
    const pasted = placeAt(
      clipboard.map((entry) => cloneWithNewIds(pasteSource(entry, doc.children, target), generateNodeId)),
      point
    );
    const children = pasted.reduce((nodes, node) => appendToParent(nodes, target, node), doc.children);
    set(pushHistory(get(), { ...doc, children }));
    set({ selectedNodeIds: pasted.map((node) => node.id) });
  },

  pasteToReplace: () => {
    const { clipboard, document: doc, selectedNodeIds } = get();
    const targets = topmostSelected(doc.children, selectedNodeIds);
    if (clipboard.length === 0 || targets.length !== 1) return;
    const parentId = findParentId(doc.children, targets[0]) ?? null;
    const replacements = clipboard.map((entry) =>
      cloneWithNewIds(pasteSource(entry, doc.children, parentId), generateNodeId)
    );
    const children = replaceNode(doc.children, targets[0], replacements);
    if (!children) return;
    set(pushHistory(get(), { ...doc, children }));
    set({ selectedNodeIds: replacements.map((node) => node.id) });
  },

  createComponent: () => {
    const { document: doc, selectedNodeIds } = get();
    const ids = topmostSelected(doc.children, selectedNodeIds);
    if (ids.length === 0) return;
    const single = ids.length === 1 ? findNodeById(doc.children, ids[0]) : undefined;
    if (single?.type === 'frame') {
      if (single.reusable) return;
      set(pushHistory(get(), { ...doc, children: updateNodeInTree(doc.children, single.id, { reusable: true }) }));
      return;
    }
    const wrapperId = generateNodeId();
    const wrapped = wrapNodes(doc.children, ids, 'frame', wrapperId);
    if (!wrapped) return;
    const children = updateNodeInTree(wrapped, wrapperId, { reusable: true, name: 'Component' });
    set(pushHistory(get(), { ...doc, children }));
    set({ selectedNodeIds: [wrapperId] });
  },

  insertInstance: (masterId, { parentId, x, y }) => {
    const { document: doc } = get();
    const master = findMaster(doc.children, masterId);
    if (!master || wouldNest(doc.children, masterId, parentId ?? null)) return null;
    const node = createInstance(master, generateNodeId(), { x, y });
    const parent = parentId ? findNodeById(doc.children, parentId) : null;
    const target = parent && 'children' in parent && parent.children ? parent.id : null;
    set(pushHistory(get(), { ...doc, children: appendToParent(doc.children, target, node) }));
    set({ selectedNodeIds: [node.id] });
    return node.id;
  },

  detachSelection: () => {
    const { document: doc, selectedNodeIds } = get();
    const children = topmostSelected(doc.children, selectedNodeIds).reduce((nodes, id) => {
      const node = findNodeById(nodes, id);
      const resolved = node?.type === 'component' ? resolveInstance(node, doc.children) : null;
      if (!resolved) return nodes;
      const copy = { ...cloneWithNewIds(resolved, generateNodeId), id } as PenNode;
      return replaceNode(nodes, id, [copy]) ?? nodes;
    }, doc.children);
    if (children === doc.children) return;
    set(pushHistory(get(), { ...doc, children }));
  },

  appendGeneratedDesigns: (tabId, designs, direction) => {
    const state = get();
    const target = tabId === state.activeTabId ? state.document : state.tabs.find((t) => t.id === tabId)?.document;
    if (!target) return false;
    return get().appendPlacedFrames(tabId, placeDesigns(designs, target.children, direction));
  },

  appendPlacedFrames: (tabId, frames) => {
    // Generation is async: the user may have switched tabs while it ran
    const state = get();
    const appendTo = (doc: PenDocument): PenDocument => ({ ...doc, children: [...doc.children, ...frames] });

    if (tabId === state.activeTabId) {
      set(pushHistory(state, appendTo(state.document)));
      return true;
    }
    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab) return false;
    const updated = pushHistory({ ...state, ...activateTab(tab) }, appendTo(tab.document));
    set({ tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, ...updated } : t)) });
    return true;
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      set({
        document: JSON.parse(JSON.stringify(prev.document)),
        historyIndex: historyIndex - 1,
        isDirty: true,
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      set({
        document: JSON.parse(JSON.stringify(next.document)),
        historyIndex: historyIndex + 1,
        isDirty: true,
      });
    }
  },
}));
