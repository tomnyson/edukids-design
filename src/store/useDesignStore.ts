import { create } from 'zustand';
import { PenDocument, PenNode, FrameNode } from '../types/pen-ast';
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

  // Multi-variant generator
  generateWebVariants: (topic: string) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
}

// Generate the 6 Landing Page Artboards from the screenshot
function createMultiVariantArtboards(): PenNode[] {
  const variantTitles = [
    '1. Neon Glass',
    '2. Variant B — Blue x Modern',
    '3. Variant C — Thanh Hải Pro',
    '4. Variant D — In Nhanh Tech',
    '5. Thanh Hải — Dark AI',
    '6. Variant F — Modern Cyan',
  ];

  const artboards: PenNode[] = [];
  const startX = 350;
  const startY = 80;
  const artboardWidth = 240;
  const artboardHeight = 1100;
  const spacing = 40;

  variantTitles.forEach((title, idx) => {
    const isDark = idx % 2 === 0;
    const accentColor = idx === 0 ? '#38bdf8' : idx === 1 ? '#3b82f6' : idx === 2 ? '#6366f1' : '#06b6d4';

    const frame: FrameNode = {
      id: `variant-frame-${idx + 1}`,
      type: 'frame',
      name: title,
      x: startX + idx * (artboardWidth + spacing),
      y: startY,
      width: artboardWidth,
      height: artboardHeight,
      fill: '#0f111a',
      stroke: '#1e2130',
      strokeWidth: 1,
      cornerRadius: 12,
      clip: true,
      layout: 'flex',
      flexDirection: 'column',
      gap: 12,
      padding: 12,
      children: [
        // Navbar
        {
          id: `nav-${idx}`,
          type: 'frame',
          name: 'Navbar',
          x: 0,
          y: 0,
          width: 216,
          height: 32,
          fill: '#151724',
          cornerRadius: 6,
          layout: 'flex',
          justifyContent: 'between',
          alignItems: 'center',
          padding: 8,
          children: [
            {
              id: `logo-${idx}`,
              type: 'text',
              name: 'Brand Logo',
              content: 'THANH HẢI',
              fontSize: 10,
              fontWeight: '700',
              fill: accentColor,
            },
            {
              id: `menu-btn-${idx}`,
              type: 'frame',
              name: 'Action',
              width: 44,
              height: 20,
              fill: accentColor,
              cornerRadius: 4,
              layout: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              children: [
                {
                  id: `btn-txt-${idx}`,
                  type: 'text',
                  content: 'Liên hệ',
                  fontSize: 8,
                  fill: '#ffffff',
                },
              ],
            },
          ],
        },

        // Hero Banner
        {
          id: `hero-${idx}`,
          type: 'frame',
          name: 'Hero Section',
          x: 0,
          y: 0,
          width: 216,
          height: 120,
          fill: '#161929',
          stroke: accentColor,
          strokeWidth: 1,
          cornerRadius: 8,
          layout: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 6,
          padding: 10,
          children: [
            {
              id: `h-tag-${idx}`,
              type: 'text',
              name: 'Tagline',
              content: 'IN NHANH CHẤT LƯỢNG CAO',
              fontSize: 7,
              fontWeight: '700',
              fill: accentColor,
            },
            {
              id: `h-title-${idx}`,
              type: 'text',
              name: 'Heading',
              content: 'IN ĐẸP DẤU GIÀY',
              fontSize: 14,
              fontWeight: '700',
              fill: '#ffffff',
              textAlign: 'center',
            },
            {
              id: `h-sub-${idx}`,
              type: 'text',
              name: 'Subhead',
              content: 'Công nghệ in chuyển nhiệt & offset 2026',
              fontSize: 8,
              fill: '#94a3b8',
              textAlign: 'center',
            },
          ],
        },

        // Product Catalog Grid
        {
          id: `grid-${idx}`,
          type: 'frame',
          name: 'Sản Phẩm Nổi Bật',
          x: 0,
          y: 0,
          width: 216,
          height: 110,
          fill: '#131522',
          cornerRadius: 8,
          layout: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 8,
          children: [
            {
              id: `grid-title-${idx}`,
              type: 'text',
              content: 'Sản Phẩm Mới',
              fontSize: 9,
              fontWeight: '600',
              fill: '#e2e8f0',
            },
            {
              id: `cards-row-${idx}`,
              type: 'frame',
              name: 'Card Row',
              x: 0,
              y: 0,
              width: 200,
              height: 70,
              layout: 'flex',
              gap: 6,
              children: [
                {
                  id: `card-1-${idx}`,
                  type: 'frame',
                  width: 97,
                  height: 65,
                  fill: '#1c1f30',
                  cornerRadius: 6,
                  padding: 4,
                  children: [],
                },
                {
                  id: `card-2-${idx}`,
                  type: 'frame',
                  width: 97,
                  height: 65,
                  fill: '#1c1f30',
                  cornerRadius: 6,
                  padding: 4,
                  children: [],
                },
              ],
            },
          ],
        },

        // Video / Workflow Section
        {
          id: `process-${idx}`,
          type: 'frame',
          name: 'Quy Trình In Ấn',
          x: 0,
          y: 0,
          width: 216,
          height: 90,
          fill: '#141624',
          cornerRadius: 8,
          padding: 8,
          layout: 'flex',
          flexDirection: 'column',
          gap: 6,
          children: [
            {
              id: `pr-title-${idx}`,
              type: 'text',
              content: 'Quy Trình 4 Bước',
              fontSize: 9,
              fontWeight: '600',
              fill: '#cbd5e1',
            },
            {
              id: `pr-box-${idx}`,
              type: 'frame',
              width: 200,
              height: 55,
              fill: '#0d0f1a',
              cornerRadius: 6,
              children: [],
            },
          ],
        },

        // Testimonial / Client section
        {
          id: `client-${idx}`,
          type: 'frame',
          name: 'Cảm Nhận Khách Hàng',
          x: 0,
          y: 0,
          width: 216,
          height: 120,
          fill: '#121422',
          cornerRadius: 8,
          padding: 8,
          children: [],
        },

        // Footer Section
        {
          id: `footer-${idx}`,
          type: 'frame',
          name: 'Footer',
          x: 0,
          y: 0,
          width: 216,
          height: 80,
          fill: '#0a0b12',
          cornerRadius: 6,
          padding: 8,
          children: [],
        },
      ],
    };

    artboards.push(frame);
  });

  return artboards;
}

const DEFAULT_PEN_DOC: PenDocument = {
  version: '2.13',
  children: createMultiVariantArtboards(),
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
  document: DEFAULT_PEN_DOC,
  selectedNodeIds: ['variant-frame-1'],
  hoveredNodeId: null,
  viewport: { x: 30, y: 30, zoom: 0.55 },
  activeTool: 'select',
  history: [{ document: JSON.parse(JSON.stringify(DEFAULT_PEN_DOC)) }],
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

  generateWebVariants: (topic: string) => {
    const newArtboards = createMultiVariantArtboards();
    const newDoc = { ...get().document, children: newArtboards };
    set(pushHistory(get(), newDoc));
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
