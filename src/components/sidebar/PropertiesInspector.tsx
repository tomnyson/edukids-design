import React from 'react';
import { Sliders, AlignLeft, AlignCenter, AlignRight, Columns, Rows } from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { findNodeById } from '../../core/io/pen-file-handler';
import { FrameNode, TextNode } from '../../types/pen-ast';

export const PropertiesInspector: React.FC = () => {
  const { document: doc, selectedNodeIds, updateNode } = useDesignStore();

  const selectedNode = selectedNodeIds.length === 1 ? findNodeById(doc.children, selectedNodeIds[0]) : null;

  if (!selectedNode) {
    return (
      <div className="flex flex-col h-full bg-zinc-900/40 border-l border-zinc-800/70 p-4 text-center justify-center items-center text-xs text-zinc-500 select-none">
        <Sliders className="h-6 w-6 text-zinc-600 mb-2" />
        <p>No element selected</p>
        <p className="text-[11px] text-zinc-600 mt-1">Click any element on canvas to inspect and edit</p>
      </div>
    );
  }

  const isFrame = selectedNode.type === 'frame';
  const isText = selectedNode.type === 'text';
  const frame = isFrame ? (selectedNode as FrameNode) : null;
  const text = isText ? (selectedNode as TextNode) : null;

  return (
    <div className="flex flex-col h-full bg-zinc-900/40 border-l border-zinc-800/70 text-xs text-zinc-300 select-none overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/60 font-medium text-zinc-400">
        <span className="flex items-center gap-1.5 truncate">
          <Sliders className="h-3.5 w-3.5 text-zinc-400" />
          <span className="capitalize">{selectedNode.type}</span>: {selectedNode.name}
        </span>
        <span className="text-[10px] text-zinc-500 font-mono">#{selectedNode.id}</span>
      </div>

      <div className="p-3 space-y-4">
        {/* Dimensions & Position */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Position & Size</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-zinc-500">X</span>
              <input
                type="number"
                value={selectedNode.x}
                onChange={(e) => updateNode(selectedNode.id, { x: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-500">Y</span>
              <input
                type="number"
                value={selectedNode.y}
                onChange={(e) => updateNode(selectedNode.id, { y: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-500">Width</span>
              <input
                type="number"
                value={selectedNode.width}
                onChange={(e) => updateNode(selectedNode.id, { width: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-500">Height</span>
              <input
                type="number"
                value={selectedNode.height}
                onChange={(e) => updateNode(selectedNode.id, { height: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Styling: Fill, Stroke, Radius */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Appearance</label>
          <div>
            <span className="text-[10px] text-zinc-500">Fill Color</span>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={selectedNode.fill?.startsWith('#') ? selectedNode.fill.slice(0, 7) : '#27272a'}
                onChange={(e) => updateNode(selectedNode.id, { fill: e.target.value })}
                className="h-6 w-6 rounded border border-zinc-700 bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={selectedNode.fill || ''}
                placeholder="#000000 or var(--color)"
                onChange={(e) => updateNode(selectedNode.id, { fill: e.target.value })}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <span className="text-[10px] text-zinc-500">Corner Radius</span>
            <input
              type="number"
              value={selectedNode.cornerRadius || 0}
              onChange={(e) => updateNode(selectedNode.id, { cornerRadius: Number(e.target.value) })}
              className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Text Properties */}
        {isText && text && (
          <div className="space-y-2 border-t border-zinc-800/80 pt-3">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Typography</label>
            <div>
              <span className="text-[10px] text-zinc-500">Content</span>
              <textarea
                value={text.content || ''}
                rows={2}
                onChange={(e) => updateNode(selectedNode.id, { content: e.target.value })}
                className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-zinc-500">Font Size</span>
                <input
                  type="number"
                  value={text.fontSize || 16}
                  onChange={(e) => updateNode(selectedNode.id, { fontSize: Number(e.target.value) })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-zinc-500">Font Weight</span>
                <select
                  value={text.fontWeight || '400'}
                  onChange={(e) => updateNode(selectedNode.id, { fontWeight: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="400">Regular (400)</option>
                  <option value="500">Medium (500)</option>
                  <option value="600">Semibold (600)</option>
                  <option value="700">Bold (700)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Frame Auto-Layout */}
        {isFrame && frame && (
          <div className="space-y-2 border-t border-zinc-800/80 pt-3">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Auto Layout (Flex)</label>
            <div>
              <span className="text-[10px] text-zinc-500">Mode</span>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => updateNode(selectedNode.id, { layout: frame.layout === 'flex' ? 'none' : 'flex' })}
                  className={`flex-1 py-1 rounded text-xs border ${
                    frame.layout === 'flex'
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}
                >
                  {frame.layout === 'flex' ? 'Flexbox Enabled' : 'None (Absolute)'}
                </button>
              </div>
            </div>

            {frame.layout === 'flex' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => updateNode(selectedNode.id, { flexDirection: 'row' })}
                    className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-xs border ${
                      frame.flexDirection === 'row' || !frame.flexDirection
                        ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                    }`}
                  >
                    <Columns className="h-3 w-3" />
                    Row
                  </button>
                  <button
                    onClick={() => updateNode(selectedNode.id, { flexDirection: 'column' })}
                    className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-xs border ${
                      frame.flexDirection === 'column'
                        ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                    }`}
                  >
                    <Rows className="h-3 w-3" />
                    Column
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-zinc-500">Gap (px)</span>
                    <input
                      type="number"
                      value={frame.gap || 0}
                      onChange={(e) => updateNode(selectedNode.id, { gap: Number(e.target.value) })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500">Padding (px)</span>
                    <input
                      type="number"
                      value={typeof frame.padding === 'number' ? frame.padding : 0}
                      onChange={(e) => updateNode(selectedNode.id, { padding: Number(e.target.value) })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
