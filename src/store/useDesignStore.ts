import { create } from 'zustand';
import { PenDocument, PenNode, FrameNode, TextNode, RectNode } from '../types/pen-ast';
import { generateNodeId, findNodeById, updateNodeInTree } from '../core/io/pen-file-handler';

export type ToolType = 'select' | 'frame' | 'rect' | 'text';

interface HistorySnapshot {
  document: PenDocument;
}

interface DesignState {
  // Document state
  document: PenDocument;
  selectedNodeIds: string[];
  hoveredNodeId: string | null;

  // Viewport transformation
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  activeTool: ToolType;

  // History stack for undo/redo
  history: HistorySnapshot[];
  historyIndex: number;

  // Actions
  loadDocument: (doc: PenDocument) => void;
  selectNode: (id: string | null, multi?: boolean) => void;
  hoverNode: (id: string | null) => void;
  setViewport: (x: number, y: number, zoom?: number) => void;
  setActiveTool: (tool: ToolType) => void;

  // Node Mutations
  addNode: (node: Partial<PenNode>, parentId?: string) => string;
  updateNode: (id: string, patch: Partial<PenNode>) => void;
  deleteSelectedNodes: () => void;
  moveNode: (id: string, dx: number, dy: number) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
}

const DEFAULT_WELCOME_DOC: PenDocument = {
  version: '2.13',
  children: [
    {
      id: 'frame-welcome',
      type: 'frame',
      name: 'Welcome Artboard',
      x: 100,
      y: 100,
      width: 720,
      height: 480,
      fill: '#18181b',
      stroke: '#27272a',
      strokeWidth: 1,
      cornerRadius: 16,
      clip: true,
      layout: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: 32,
      justifyContent: 'center',
      alignItems: 'center',
      children: [
        {
          id: 'text-heading',
          type: 'text',
          name: 'Hero Title',
          x: 0,
          y: 0,
          width: 500,
          height: 60,
          content: 'Pen Studio Design-as-Code',
          fontSize: 32,
          fontWeight: '700',
          fill: '#f97316',
          textAlign: 'center',
        },
        {
          id: 'text-sub',
          type: 'text',
          name: 'Subtitle',
          x: 0,
          y: 0,
          width: 480,
          height: 40,
          content: 'AI-native vector canvas with local MCP server & Claude Opus advisor',
          fontSize: 14,
          fontWeight: '400',
          fill: '#a1a1aa',
          textAlign: 'center',
        },
        {
          id: 'btn-cta',
          type: 'frame',
          name: 'Action Button',
          x: 0,
          y: 0,
          width: 200,
          height: 48,
          fill: '#ea580c',
          cornerRadius: 8,
          layout: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          children: [
            {
              id: 'btn-label',
              type: 'text',
              name: 'Button Label',
              x: 0,
              y: 0,
              width: 140,
              height: 24,
              content: 'Connect MCP Agent',
              fontSize: 14,
              fontWeight: '600',
              fill: '#ffffff',
              textAlign: 'center',
            },
          ],
        },
      ],
    },
  ],
  themes: {
    Mode: ['Light', 'Dark'],
  },
  variables: {
    '--primary': {
      type: 'color',
      value: '#ea580c',
    },
    '--background': {
      type: 'color',
      value: '#09090b',
    },
  },
};

function pushHistory(state: DesignState, newDoc: PenDocument) {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push({ document: JSON.parse(JSON.stringify(newDoc)) });
  return {
    document: newDoc,
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

export const useDesignStore = create<DesignState>((set, get) => ({
  document: DEFAULT_WELCOME_DOC,
  selectedNodeIds: ['frame-welcome'],
  hoveredNodeId: null,
  viewport: { x: 50, y: 50, zoom: 1 },
  activeTool: 'select',
  history: [{ document: JSON.parse(JSON.stringify(DEFAULT_WELCOME_DOC)) }],
  historyIndex: 0,

  loadDocument: (doc) => {
    set({
      document: doc,
      selectedNodeIds: [],
      history: [{ document: JSON.parse(JSON.stringify(doc)) }],
      historyIndex: 0,
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
        zoom: zoom !== undefined ? Math.max(0.1, Math.min(5, zoom)) : state.viewport.zoom,
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
      x: Math.round(current.x + dx),
      y: Math.round(current.y + dy),
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      set({
        document: JSON.parse(JSON.stringify(prev.document)),
        historyIndex: historyIndex - 1,
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
      });
    }
  },
}));
