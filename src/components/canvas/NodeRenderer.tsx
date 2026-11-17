import React, { useMemo } from 'react';
import { ImageIcon, Shapes } from 'lucide-react';
import { DynamicIcon, iconNames, IconName } from 'lucide-react/dynamic';
import { PenNode, FrameNode, TextNode, PathNode, ImageNode, ComponentNode, IconNode } from '../../types/pen-ast';
import { useDesignStore } from '../../store/useDesignStore';
import { imageFit, safeImageSrc } from '../../lib/image-source';
import { resolveInstance } from '../../lib/components';
import { boxStyle, effectStyle, FlowLayout, frameLayoutStyle, layoutOf, paintStyle, textStyle } from './node-style';

/** Masters and instances are labelled in the component colour */
const COMPONENT_LABEL_CLASS = 'text-violet-400';

/** Fill of a shape drawn without one, so a new shape is never invisible */
const DEFAULT_SHAPE_FILL = '#3f3f46';

const LUCIDE_NAMES: ReadonlySet<string> = new Set(iconNames);

type ElementProps = React.HTMLAttributes<HTMLDivElement> & { id?: string };

interface FrameBoxProps {
  frame: FrameNode;
  style: React.CSSProperties;
  elementProps: ElementProps;
  label?: string;
  labelClass?: string;
  /** Children are drawn as static copies (an instance's content cannot be picked) */
  previewChildren: boolean;
}

/** Fills the frame's box and holds its children, so clipping them leaves the frame's label visible */
const FRAME_CONTENT_STYLE: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  borderRadius: 'inherit',
};

function FrameBox({ frame, style, elementProps, label, labelClass, previewChildren }: FrameBoxProps) {
  const flow = layoutOf(frame);
  return (
    <div {...elementProps} style={{ ...style, ...paintStyle(frame), ...effectStyle(frame) }}>
      {label !== undefined && (
        <div className={`absolute -top-5 left-0 text-[11px] font-mono select-none whitespace-nowrap ${labelClass}`}>
          {label}
        </div>
      )}
      <div style={{ ...FRAME_CONTENT_STYLE, ...frameLayoutStyle(frame) }}>
        {frame.children?.map((child) => (
          <NodeRenderer key={child.id} node={child} parent={flow} preview={previewChildren} />
        ))}
      </div>
    </div>
  );
}

interface InstanceBoxProps {
  instance: ComponentNode;
  style: React.CSSProperties;
  elementProps: ElementProps;
  parent?: FlowLayout;
  label?: string;
}

/**
 * An instance drawn as the frame it shows: its master's content, re-read on
 * every document change so edits to the master appear at once.
 */
function InstanceBox({ instance, style, elementProps, parent, label }: InstanceBoxProps) {
  const docNodes = useDesignStore((state) => state.document.children);
  const resolved = useMemo(() => resolveInstance(instance, docNodes), [instance, docNodes]);
  if (!resolved) {
    return (
      <div
        {...elementProps}
        style={{ ...boxStyle(instance, parent), ...style }}
        className="flex items-center justify-center border border-dashed border-violet-400/60 text-[11px] text-violet-300"
      >
        Component không còn
      </div>
    );
  }
  return (
    <FrameBox
      frame={resolved}
      style={{ ...boxStyle(resolved, parent), ...style }}
      elementProps={elementProps}
      label={label}
      labelClass={COMPONENT_LABEL_CLASS}
      previewChildren
    />
  );
}

/** A pen.dev icon; lucide names are drawn, other libraries get a placeholder glyph */
function IconGlyph({ icon }: { icon: IconNode }) {
  const name = icon.icon ?? '';
  const known = (icon.library === undefined || icon.library === 'lucide') && LUCIDE_NAMES.has(name);
  const size = Math.min(icon.width ?? 24, icon.height ?? 24);
  const color = icon.fill || 'currentColor';
  return known ? (
    <DynamicIcon name={name as IconName} size={size} color={color} strokeWidth={icon.weight ?? 2} />
  ) : (
    <Shapes size={size} color={color} opacity={0.5} />
  );
}

interface NodeRendererProps {
  node: PenNode;
  isRoot?: boolean;
  /** The parent's flow layout; children of a flex frame are placed by it, not by x/y */
  parent?: FlowLayout;
  /** Static copy for thumbnails: no ids, handlers, outlines or frame label */
  preview?: boolean;
}

export const NodeRenderer: React.FC<NodeRendererProps> = ({ node, isRoot = false, parent, preview = false }) => {
  const isSelected = useDesignStore((state) => !preview && state.selectedNodeIds.includes(node.id));
  const isHovered = useDesignStore((state) => !preview && state.hoveredNodeId === node.id);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    useDesignStore.getState().selectNode(node.id, e.shiftKey || e.metaKey);
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    useDesignStore.getState().hoverNode(node.id);
  };

  const handleMouseLeave = () => {
    useDesignStore.getState().hoverNode(null);
  };

  // Canvas nodes are found by these ids, so a preview must not repeat them
  const elementProps: ElementProps = preview
    ? {}
    : {
        id: `node-${node.id}`,
        onClick: handleClick,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
      };

  const interactionStyles: React.CSSProperties = {
    outline: isSelected ? '2px solid #3b82f6' : isHovered ? '1px dashed #60a5fa' : undefined,
    outlineOffset: preview ? undefined : '2px',
    cursor: preview ? undefined : 'pointer',
    transition: preview ? undefined : 'outline 0.1s ease',
  };

  const commonStyles: React.CSSProperties = { ...boxStyle(node, parent), ...interactionStyles };

  switch (node.type) {
    case 'frame': {
      const frame = node as FrameNode;
      const showLabel = isRoot && !preview;
      return (
        <FrameBox
          frame={frame}
          style={commonStyles}
          elementProps={elementProps}
          label={showLabel ? (frame.reusable ? `◇ ${frame.name || 'Component'}` : frame.name || 'Frame') : undefined}
          labelClass={frame.reusable ? COMPONENT_LABEL_CLASS : 'text-zinc-400'}
          previewChildren={preview}
        />
      );
    }

    case 'text': {
      const text = node as TextNode;
      return (
        <div {...elementProps} style={{ ...commonStyles, ...textStyle(text), ...effectStyle(text) }}>
          {text.content || 'Text'}
        </div>
      );
    }

    case 'icon': {
      const icon = node as IconNode;
      return (
        <div
          {...elementProps}
          style={{
            ...commonStyles,
            ...effectStyle(icon),
            display: commonStyles.display ?? 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconGlyph icon={icon} />
        </div>
      );
    }

    case 'path': {
      const pathNode = node as PathNode;
      return (
        <div {...elementProps} style={{ ...commonStyles, ...effectStyle(pathNode) }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
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

    case 'image': {
      const image = node as ImageNode;
      const src = safeImageSrc(image.src);
      const imageStyles: React.CSSProperties = {
        ...commonStyles,
        ...paintStyle(image),
        ...effectStyle(image),
        backgroundColor: src ? undefined : '#27272a',
        overflow: 'hidden',
        display: commonStyles.display ?? (src ? undefined : 'flex'),
        alignItems: 'center',
        justifyContent: 'center',
      };

      return (
        <div {...elementProps} style={imageStyles}>
          {src ? (
            <img
              src={src}
              alt={image.alt ?? image.name ?? ''}
              draggable={false}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: imageFit(image.fit),
                pointerEvents: 'none',
              }}
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-zinc-500" />
          )}
        </div>
      );
    }

    case 'component': {
      const instance = node as ComponentNode;
      return (
        <InstanceBox
          instance={instance}
          style={interactionStyles}
          elementProps={elementProps}
          parent={parent}
          label={isRoot && !preview ? `◆ ${instance.name || 'Instance'}` : undefined}
        />
      );
    }

    case 'rect':
    case 'ellipse':
    default: {
      const unpainted = !node.fill && !node.stroke;
      return (
        <div
          {...elementProps}
          style={{
            ...commonStyles,
            ...paintStyle(unpainted ? { ...node, fill: DEFAULT_SHAPE_FILL } : node),
            ...effectStyle(node),
          }}
        />
      );
    }
  }
};
