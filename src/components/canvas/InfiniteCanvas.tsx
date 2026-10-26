import React, { useRef, useState, useEffect } from 'react';
import { useDesignStore } from '../../store/useDesignStore';
import { NodeRenderer } from './NodeRenderer';

export const InfiniteCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Handle Wheel: Pan (standard trackpad scroll) and Zoom (pinch or metaKey wheel)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = Math.min(Math.max(viewport.zoom * zoomFactor, 0.1), 5);

      // Zoom towards mouse pointer
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newX = mouseX - (mouseX - viewport.x) * (newZoom / viewport.zoom);
        const newY = mouseY - (mouseY - viewport.y) * (newZoom / viewport.zoom);
        setViewport(newX, newY, newZoom);
      }
    } else {
      // Pan
      setViewport(viewport.x - e.deltaX, viewport.y - e.deltaY);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click, spacebar pressed, or click on empty canvas with select tool
    if (e.button === 1 || isSpacePressed || (e.button === 0 && e.target === containerRef.current)) {
      if (activeTool === 'select' || e.button === 1) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
        selectNode(null);
      } else {
        // Create element based on active tool at clicked coordinates
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const canvasX = Math.round((e.clientX - rect.left - viewport.x) / viewport.zoom);
          const canvasY = Math.round((e.clientY - rect.top - viewport.y) / viewport.zoom);

          if (activeTool === 'frame') {
            addNode({
              type: 'frame',
              name: 'New Artboard',
              x: canvasX,
              y: canvasY,
              width: 320,
              height: 240,
              fill: '#18181b',
              cornerRadius: 12,
              stroke: '#27272a',
              strokeWidth: 1,
            });
          } else if (activeTool === 'rect') {
            addNode({
              type: 'rect',
              name: 'Rectangle',
              x: canvasX,
              y: canvasY,
              width: 140,
              height: 100,
              fill: '#27272a',
              cornerRadius: 8,
            });
          } else if (activeTool === 'text') {
            addNode({
              type: 'text',
              name: 'Text Layer',
              x: canvasX,
              y: canvasY,
              width: 180,
              height: 32,
              content: 'Heading Text',
              fontSize: 20,
              fontWeight: '600',
              fill: '#fafafa',
            });
          }
          setActiveTool('select');
        }
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

  // Keyboard shortcuts (Space to pan, Delete to remove, Esc to deselect)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(true);
      } else if (e.key === 'Escape') {
        selectNode(null);
        setActiveTool('select');
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        // Prevent deleting when focused on input
        if (
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA'
        ) {
          useDesignStore.getState().deleteSelectedNodes();
        }
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        if (e.shiftKey) {
          useDesignStore.getState().redo();
        } else {
          useDesignStore.getState().undo();
        }
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
      className={`relative w-full h-full overflow-hidden bg-zinc-950 ${
        isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        backgroundImage: `radial-gradient(circle, #27272a 1px, transparent 1px)`,
        backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
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
      </div>

      {/* Floating Canvas Quick Controls (Zoom, Reset) */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-zinc-900/80 backdrop-blur-md border border-zinc-800/80 rounded-lg px-2.5 py-1 text-xs text-zinc-300 font-mono shadow-lg select-none">
        <button
          onClick={() => setViewport(viewport.x, viewport.y, viewport.zoom * 0.85)}
          className="hover:text-white px-1.5 py-0.5 rounded transition"
        >
          -
        </button>
        <span className="w-12 text-center">{Math.round(viewport.zoom * 100)}%</span>
        <button
          onClick={() => setViewport(viewport.x, viewport.y, viewport.zoom * 1.15)}
          className="hover:text-white px-1.5 py-0.5 rounded transition"
        >
          +
        </button>
        <button
          onClick={() => setViewport(50, 50, 1)}
          className="ml-2 text-[10px] text-zinc-400 hover:text-white transition border-l border-zinc-800 pl-2"
        >
          Reset
        </button>
      </div>
    </div>
  );
};
