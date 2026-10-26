import React from 'react';
import { Layers, Square, Type, Frame, Eye, Trash2 } from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { PenNode } from '../../types/pen-ast';

interface LayerItemProps {
  node: PenNode;
  depth?: number;
}

const LayerItem: React.FC<LayerItemProps> = ({ node, depth = 0 }) => {
  const { selectedNodeIds, selectNode, deleteSelectedNodes } = useDesignStore();
  const isSelected = selectedNodeIds.includes(node.id);

  const getIcon = () => {
    switch (node.type) {
      case 'frame':
        return <Frame className="h-3.5 w-3.5 text-orange-400" />;
      case 'text':
        return <Type className="h-3.5 w-3.5 text-blue-400" />;
      case 'rect':
      default:
        return <Square className="h-3.5 w-3.5 text-zinc-400" />;
    }
  };

  return (
    <div>
      <div
        onClick={(e) => {
          e.stopPropagation();
          selectNode(node.id, e.shiftKey || e.metaKey);
        }}
        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-xs transition ${
          isSelected
            ? 'bg-blue-600/20 text-blue-300 font-medium border border-blue-500/30'
            : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
        }`}
        style={{ paddingLeft: `${depth * 12 + 10}px` }}
      >
        <div className="flex items-center gap-2 truncate">
          {getIcon()}
          <span className="truncate">{node.name || `${node.type}-${node.id}`}</span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={(e) => {
              e.stopPropagation();
              selectNode(node.id);
              deleteSelectedNodes();
            }}
            className="text-zinc-500 hover:text-red-400 p-0.5"
            title="Delete node"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {'children' in node && node.children && (
        <div>
          {node.children.map((child) => (
            <LayerItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const LayerTree: React.FC = () => {
  const { document: doc } = useDesignStore();

  const countNodes = (nodes: PenNode[]): number => {
    return nodes.reduce((acc, curr) => {
      const childCount = 'children' in curr && curr.children ? countNodes(curr.children) : 0;
      return acc + 1 + childCount;
    }, 0);
  };

  const total = countNodes(doc.children);

  return (
    <div className="flex flex-col h-full bg-zinc-900/40 border-r border-zinc-800/70 select-none">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/60 text-xs font-medium text-zinc-400">
        <span className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-zinc-400" />
          Document Layers
        </span>
        <span className="text-[10px] text-zinc-500 font-mono">{total} nodes</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {doc.children.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-600">Canvas is empty</div>
        ) : (
          doc.children.map((node) => <LayerItem key={node.id} node={node} depth={0} />)
        )}
      </div>
    </div>
  );
};
