import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useDesignStore } from '../../store/useDesignStore';
import { NodeRenderer } from './NodeRenderer';
import { readImageFile } from '../../lib/image-source';
import { CANVAS_ELEMENT_ID, imageNameFromFile, insertImage } from '../../lib/image-insert';
import { notify } from '../../lib/toast';
import { ZOOM_STEP, isEditableTarget, nudgeForKey, toolForKey, zoomAround } from '../../lib/canvas-editing';
import { NODE_ID_PREFIX, suppressNextClick, useNodeDrag } from '../../hooks/useNodeDrag';
import { findNodeById } from '../../core/io/pen-file-handler';
import { selectionForContextTarget, shortcutForKey } from '../../lib/context-menu';
import { CanvasContextMenu, ContextMenuState } from './CanvasContextMenu';
import { runContextAction } from './context-actions';
import { useDocumentFonts } from '../../hooks/useDocumentFonts';
import { GenerationRunLayer, useFitGenerationRun } from './GenerationRunLayer';
import { useGenerationStore } from '../../store/useGenerationStore';

/** Gap between images dropped together, in canvas px */
const DROP_STAGGER = 24;
/** Zoom change per wheel notch with Cmd/Ctrl held (or a trackpad pinch) */
const WHEEL_ZOOM_STEP = 1.08;

export const InfiniteCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  useFitGenerationRun(containerRef);
  // A run's placeholders already fill the canvas, so the empty-state hint would cover them
  const runTabId = useGenerationStore((state) => state.run?.tabId ?? null);
  const hasGenerationRun = useDesignStore((state) => state.activeTabId === runTabId);
  const {
    document: doc,
    viewport,
    setViewport,
    selectNode,
    activeTool,
    setActiveTool,
    addNode,
  } = useDesignStore();

  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const startNodeDrag = useNodeDrag();
  useDocumentFonts(doc.children);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Dropped image files become image nodes centred on the drop point
  const handleDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    // Always cancel file drops, otherwise the browser opens the file and the unsaved design is lost
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) {
      notify('⚠️ Chỉ thả được file ảnh.');
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { x, y, zoom } = useDesignStore.getState().viewport;
    const dropX = (e.clientX - rect.left - x) / zoom;
    const dropY = (e.clientY - rect.top - y) / zoom;

    files.reduce(
      (previous, file, index) =>
        previous.then(async () => {
          const offset = index * DROP_STAGGER;
          try {
            await insertImage(await readImageFile(file), {
              name: imageNameFromFile(file),
              center: { x: dropX + offset, y: dropY + offset },
            });
          } catch (error) {
            notify(`⚠️ ${error instanceof Error ? error.message : 'Không thêm được ảnh.'}`, 4000);
          }
        }),
      Promise.resolve()
    );
  };

  // Wheel pans; Cmd/Ctrl + wheel (and trackpad pinch) zooms towards the pointer.
  // Registered natively: React's onWheel is passive, so preventDefault would be ignored
  // and the browser would zoom the whole page.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { viewport: current, setViewport: apply } = useDesignStore.getState();
      if (e.ctrlKey || e.metaKey) {
        const rect = container.getBoundingClientRect();
        const factor = e.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP;
        const next = zoomAround(current, factor, { x: e.clientX - rect.left, y: e.clientY - rect.top });
        apply(next.x, next.y, next.zoom);
      } else {
        apply(current.x - e.deltaX, current.y - e.deltaY);
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Zoom buttons keep the centre of the canvas in place
  const zoomBy = (factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const pivot = rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: 0, y: 0 };
    const next = zoomAround(viewport, factor, pivot);
    setViewport(next.x, next.y, next.zoom);
  };

  /** Adds a node for the active tool at (x, y), relative to the parent frame or the canvas origin */
  const createNodeAt = (x: number, y: number, parentId?: string) => {
    if (activeTool === 'frame') {
      addNode(
        {
          type: 'frame',
          name: 'New Artboard',
          x,
          y,
          width: 320,
          height: 480,
          fill: '#0f111a',
          cornerRadius: 12,
          stroke: '#1e2130',
          strokeWidth: 1,
        },
        parentId
      );
    } else if (activeTool === 'ellipse') {
      addNode({ type: 'ellipse', name: 'Ellipse', x, y, width: 120, height: 120, fill: '#1c1f30' }, parentId);
    } else if (activeTool === 'rect') {
      addNode(
        { type: 'rect', name: 'Rectangle', x, y, width: 140, height: 100, fill: '#1c1f30', cornerRadius: 8 },
        parentId
      );
    } else if (activeTool === 'text') {
      addNode(
        {
          type: 'text',
          name: 'Text Layer',
          x,
          y,
          width: 180,
          height: 32,
          content: 'Heading Text',
          fontSize: 20,
          fontWeight: '600',
          fill: '#fafafa',
        },
        parentId
      );
    }
    setActiveTool('select');
  };

  /** Innermost frame under the pointer, so drawing tools can place shapes inside it */
  const frameElementAt = (target: EventTarget): { id: string; el: HTMLElement } | null => {
    const { document: current } = useDesignStore.getState();
    let el = (target as Element).closest?.<HTMLElement>(`[id^="${NODE_ID_PREFIX}"]`) ?? null;
    while (el) {
      const id = el.id.slice(NODE_ID_PREFIX.length);
      const node = findNodeById(current.children, id);
      if (node?.type === 'frame') return { id, el };
      el = el.parentElement?.closest<HTMLElement>(`[id^="${NODE_ID_PREFIX}"]`) ?? null;
    }
    return null;
  };

  // Right-click selects the layer under the pointer (keeping a selection that contains it) and opens the layer menu
  const handleContextMenu = (e: React.MouseEvent) => {
    // Text being edited keeps the browser's own menu (spellcheck, paste)
    if (isEditableTarget(e.target)) return;
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const { selectedNodeIds, viewport: current, document: currentDoc } = useDesignStore.getState();
    const nodeEl = (e.target as Element).closest?.<HTMLElement>(`[id^="${NODE_ID_PREFIX}"]`) ?? null;
    const targetId = nodeEl ? nodeEl.id.slice(NODE_ID_PREFIX.length) : null;
    const nextSelection = selectionForContextTarget(selectedNodeIds, targetId, currentDoc.children);
    if (nextSelection !== selectedNodeIds) selectNode(nextSelection[0] ?? null);

    const frame = frameElementAt(e.target);
    const origin = frame
      ? frame.el.getBoundingClientRect()
      : (() => {
          const rect = container.getBoundingClientRect();
          return { left: rect.left + current.x, top: rect.top + current.y };
        })();
    setContextMenu({
      screen: { x: e.clientX, y: e.clientY },
      targetIsNode: targetId !== null,
      paste: {
        parentId: frame?.id ?? null,
        point: {
          x: Math.round((e.clientX - origin.left) / current.zoom),
          y: Math.round((e.clientY - origin.top) / current.zoom),
        },
      },
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Right button belongs to the context menu
    if (e.button === 2) return;
    const onNode = e.target !== containerRef.current;
    if (e.button === 0 && !isSpacePressed && onNode) {
      if (activeTool === 'select') {
        if (startNodeDrag(e)) return;
      } else {
        const frame = frameElementAt(e.target);
        if (frame) {
          const rect = frame.el.getBoundingClientRect();
          createNodeAt(
            Math.round((e.clientX - rect.left) / viewport.zoom),
            Math.round((e.clientY - rect.top) / viewport.zoom),
            frame.id
          );
          // The click that follows would select the frame instead of the new node
          window.addEventListener('mouseup', suppressNextClick, { once: true });
          return;
        }
      }
    }
    // Middle click, spacebar pressed, or click on empty canvas with select tool
    if (e.button === 1 || isSpacePressed || (e.button === 0 && !onNode)) {
      if (activeTool === 'select' || e.button === 1) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
        selectNode(null);
      } else if (containerRef.current) {
        // Create element based on active tool at clicked coordinates
        const rect = containerRef.current.getBoundingClientRect();
        createNodeAt(
          Math.round((e.clientX - rect.left - viewport.x) / viewport.zoom),
          Math.round((e.clientY - rect.top - viewport.y) / viewport.zoom)
        );
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setViewport(e.clientX - panStart.x, e.clientY - panStart.y);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Keyboard shortcuts. Everything except Escape is ignored while typing in a field.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        selectNode(null);
        setActiveTool('select');
        return;
      }
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return;
      // An open modal or menu owns the keyboard
      if (document.querySelector('[aria-modal="true"]')) return;
      if (document.activeElement?.closest('[role="menu"]')) return;

      const store = useDesignStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const tool = toolForKey(e);
      const nudge = nudgeForKey(e);
      const action = shortcutForKey(e);

      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(true);
      } else if (action) {
        e.preventDefault();
        runContextAction(action);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        store.deleteSelectedNodes();
      } else if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        store.redo();
      } else if (mod && key === 'a') {
        e.preventDefault();
        store.selectAll();
      } else if (mod && key === 'c') {
        store.copySelection();
      } else if (mod && key === 'v') {
        store.pasteClipboard();
      } else if (mod && key === 'd') {
        // Cmd+D would otherwise bookmark the page
        e.preventDefault();
        store.duplicateSelection();
      } else if (nudge && store.selectedNodeIds.length > 0) {
        e.preventDefault();
        store.moveNodes(store.selectedNodeIds, nudge.dx, nudge.dy);
      } else if (tool && !e.shiftKey) {
        setActiveTool(tool);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id={CANVAS_ELEMENT_ID}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative w-full h-full overflow-hidden bg-[#0c0d12] ${
        isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
      style={{
        backgroundImage: `radial-gradient(circle, #1a1c29 1px, transparent 1px)`,
        backgroundSize: `${28 * viewport.zoom}px ${28 * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
    >
      {/* Canvas Viewport Transformation Layer */}
      <div
        className="absolute top-0 left-0 origin-top-left pointer-events-auto"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {doc.children.map((child) => (
          <NodeRenderer key={child.id} node={child} isRoot={true} />
        ))}
        <GenerationRunLayer />
      </div>

      {/* Blank Canvas Empty State Helper (pointer-events-none) */}
      {doc.children.length === 0 && !hasGenerationRun && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
          <div className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-[#141520]/70 border border-[#232538] backdrop-blur-xs text-center max-w-xs animate-in fade-in zoom-in-95 duration-200">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 font-bold text-xs">
              P
            </div>
            <p className="text-xs font-medium text-zinc-200">Canvas trống</p>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Nhập ý tưởng vào khung chat bên trái để AI tạo layout hoặc chọn công cụ Frame (F) để tự vẽ.
            </p>
          </div>
        </div>
      )}

      {/* Floating Canvas Quick Controls (Zoom: -, 9%, +) matching pen.dev bottom-right */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-[#161722]/90 backdrop-blur-md border border-[#27293b] rounded-full px-3 py-1.5 text-xs text-zinc-300 font-mono shadow-2xl select-none z-20">
        <button
          onClick={() => zoomBy(1 / ZOOM_STEP)}
          className="hover:text-white px-1.5 py-0.5 rounded transition"
          title="Zoom Out"
        >
          -
        </button>
        <span className="w-12 text-center text-xs font-semibold text-zinc-200">
          {Math.round(viewport.zoom * 100)}%
        </span>
        <button
          onClick={() => zoomBy(ZOOM_STEP)}
          className="hover:text-white px-1.5 py-0.5 rounded transition"
          title="Zoom In"
        >
          +
        </button>
      </div>

      {contextMenu && <CanvasContextMenu menu={contextMenu} onClose={closeContextMenu} />}
    </div>
  );
};
