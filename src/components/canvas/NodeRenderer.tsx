import React from 'react';
import { PenNode, FrameNode, TextNode, PathNode } from '../../types/pen-ast';
import { useDesignStore } from '../../store/useDesignStore';

interface NodeRendererProps {
  node: PenNode;
  isRoot?: boolean;
}

export const NodeRenderer: React.FC<NodeRendererProps> = ({ node, isRoot = false }) => {
  const { selectedNodeIds, hoveredNodeId, selectNode, hoverNode } = useDesignStore();
  const isSelected = selectedNodeIds.includes(node.id);
  const isHovered = hoveredNodeId === node.id;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node.id, e.shiftKey || e.metaKey);
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    hoverNode(node.id);
  };

  const handleMouseLeave = () => {
    hoverNode(null);
  };

  const commonStyles: React.CSSProperties = {
    position: 'absolute',
    left: `${node.x}px`,
    top: `${node.y}px`,
    width: `${node.width}px`,
    height: `${node.height}px`,
    transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
    opacity: node.opacity !== undefined ? node.opacity : 1,
    outline: isSelected
      ? '2px solid #3b82f6'
      : isHovered
      ? '1px dashed #60a5fa'
      : undefined,
    outlineOffset: '2px',
    cursor: 'pointer',
    transition: 'outline 0.1s ease',
  };

  switch (node.type) {
    case 'frame': {
      const frame = node as FrameNode;
      const isFlex = frame.layout === 'flex';
      const flexDir = frame.flexDirection === 'column' ? 'column' : 'row';

      const frameStyles: React.CSSProperties = {
        ...commonStyles,
        backgroundColor: frame.fill || 'transparent',
        border: frame.stroke ? `${frame.strokeWidth || 1}px solid ${frame.stroke}` : undefined,
        borderRadius: frame.cornerRadius ? `${frame.cornerRadius}px` : undefined,
        overflow: frame.clip ? 'hidden' : 'visible',
        display: isFlex ? 'flex' : 'block',
        flexDirection: isFlex ? flexDir : undefined,
        gap: isFlex && frame.gap ? `${frame.gap}px` : undefined,
        padding:
          typeof frame.padding === 'number'
            ? `${frame.padding}px`
            : Array.isArray(frame.padding)
            ? frame.padding.map((p) => `${p}px`).join(' ')
            : undefined,
        justifyContent:
          frame.justifyContent === 'center'
            ? 'center'
            : frame.justifyContent === 'end'
            ? 'flex-end'
            : frame.justifyContent === 'between'
            ? 'space-between'
            : 'flex-start',
        alignItems:
          frame.alignItems === 'center'
            ? 'center'
            : frame.alignItems === 'end'
            ? 'flex-end'
            : frame.alignItems === 'stretch'
            ? 'stretch'
            : 'flex-start',
      };

      return (
        <div
          id={`node-${node.id}`}
          style={frameStyles}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Frame Label */}
          {isRoot && (
            <div className="absolute -top-5 left-0 text-[11px] font-mono text-zinc-400 select-none whitespace-nowrap">
              {frame.name || 'Frame'}
            </div>
          )}
          {frame.children?.map((child) => (
            <NodeRenderer key={child.id} node={child} isRoot={false} />
          ))}
        </div>
      );
    }

    case 'text': {
      const text = node as TextNode;
      const textStyles: React.CSSProperties = {
        ...commonStyles,
        color: text.fill || '#ffffff',
        fontFamily: text.fontFamily || 'inherit',
        fontSize: text.fontSize ? `${text.fontSize}px` : '16px',
        fontWeight: text.fontWeight || '400',
        lineHeight: text.lineHeight || 1.4,
        textAlign: text.textAlign || 'left',
        letterSpacing: text.letterSpacing ? `${text.letterSpacing}px` : undefined,
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'pre-wrap',
        userSelect: 'none',
      };

      return (
        <div
          id={`node-${node.id}`}
          style={textStyles}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {text.content || 'Text'}
        </div>
      );
    }

    case 'path': {
      const pathNode = node as PathNode;
      return (
        <div
          id={`node-${node.id}`}
          style={commonStyles}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="overflow-visible"
          >
            <path
              d={pathNode.geometry || 'M0 0 L100 100'}
              fill={pathNode.fill || 'none'}
              stroke={pathNode.stroke || '#f97316'}
              strokeWidth={pathNode.strokeWidth || 2}
              strokeLinecap={pathNode.strokeLinecap || 'round'}
              strokeLinejoin={pathNode.strokeLinejoin || 'round'}
            />
          </svg>
        </div>
      );
    }

    case 'rect':
    default: {
      const rectStyles: React.CSSProperties = {
        ...commonStyles,
        backgroundColor: node.fill || '#3f3f46',
        border: node.stroke ? `${node.strokeWidth || 1}px solid ${node.stroke}` : undefined,
        borderRadius: node.cornerRadius ? `${node.cornerRadius}px` : undefined,
      };

      return (
        <div
          id={`node-${node.id}`}
          style={rectStyles}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      );
    }
  }
};
