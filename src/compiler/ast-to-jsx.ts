import { PenNode, FrameNode, TextNode, PathNode, ImageNode } from '../types/pen-ast';
import { imageFit, safeImageSrc } from '../lib/image-source';

/**
 * How a node sits in its parent: the root anchors the layout, children of
 * free-form frames keep their canvas x/y, children of flex frames flow.
 */
type Placement = 'root' | 'absolute' | 'flow';

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

/** Only plain hex colors become classes; anything else could break out of className */
function hexColor(value: string | undefined): string | null {
  return value && HEX_COLOR.test(value) ? value : null;
}

function flipClasses(node: PenNode): string[] {
  return [node.flipX ? '-scale-x-100' : '', node.flipY ? '-scale-y-100' : ''].filter(Boolean);
}

function placementClasses(node: PenNode, placement: Placement, hasChildren: boolean): string[] {
  if (placement === 'absolute') return ['absolute', `left-[${node.x ?? 0}px]`, `top-[${node.y ?? 0}px]`, ...flipClasses(node)];
  return [...(hasChildren ? ['relative'] : []), ...flipClasses(node)];
}

function jsxText(content: string): string {
  return /[{}<>]/.test(content) ? `{${JSON.stringify(content)}}` : content;
}

/**
 * Converts a PenNode AST into semantic React JSX string styled with Tailwind CSS
 */
export function compileAstToJsx(node: PenNode, indentLevel: number = 2, placement: Placement = 'root'): string {
  const indent = ' '.repeat(indentLevel);
  const childIndent = ' '.repeat(indentLevel + 2);

  switch (node.type) {
    case 'frame': {
      const frame = node as FrameNode;
      const hasChildren = (frame.children?.length ?? 0) > 0;
      const classNames: string[] = placementClasses(frame, placement, hasChildren && frame.layout !== 'flex');

      // Layout mode
      if (frame.layout === 'flex') {
        classNames.push('flex');
        if (frame.flexDirection === 'column') {
          classNames.push('flex-col');
        } else {
          classNames.push('flex-row');
        }

        if (frame.justifyContent === 'center') classNames.push('justify-center');
        else if (frame.justifyContent === 'end') classNames.push('justify-end');
        else if (frame.justifyContent === 'between') classNames.push('justify-between');

        if (frame.alignItems === 'center') classNames.push('items-center');
        else if (frame.alignItems === 'end') classNames.push('items-end');

        if (frame.gap) {
          const gapRem = Math.round((frame.gap / 4) * 10) / 10;
          classNames.push(`gap-[${frame.gap}px]`);
        }
      }

      // Padding
      if (frame.padding) {
        if (typeof frame.padding === 'number') {
          classNames.push(`p-[${frame.padding}px]`);
        } else if (Array.isArray(frame.padding)) {
          classNames.push(`p-[${frame.padding.join('px_')}px]`);
        }
      }

      // Size
      if (frame.width) classNames.push(`w-[${frame.width}px]`);
      if (frame.height) classNames.push(`h-[${frame.height}px]`);

      // Fill / Background
      if (frame.fill) {
        const fill = hexColor(frame.fill);
        classNames.push(fill ? `bg-[${fill}]` : 'bg-zinc-900');
      }

      // Border & Radius
      const stroke = hexColor(frame.stroke);
      if (stroke) {
        classNames.push(`border border-[${stroke}]`);
      }
      if (frame.cornerRadius) {
        classNames.push(`rounded-[${frame.cornerRadius}px]`);
      }
      if (frame.clip) {
        classNames.push('overflow-hidden');
      }

      const isButton =
        frame.name?.toLowerCase().includes('button') ||
        frame.name?.toLowerCase().includes('btn') ||
        frame.id.startsWith('btn');
      const tag = isButton ? 'button' : 'div';
      const classAttr = classNames.length > 0 ? ` className="${classNames.join(' ')}"` : '';

      if (!frame.children || frame.children.length === 0) {
        return `${indent}<${tag}${classAttr} />`;
      }

      const childPlacement: Placement = frame.layout === 'flex' ? 'flow' : 'absolute';
      const childrenJsx = frame.children
        .map((child) => compileAstToJsx(child, indentLevel + 2, childPlacement))
        .join('\n');

      return `${indent}<${tag}${classAttr}>\n${childrenJsx}\n${indent}</${tag}>`;
    }

    case 'text': {
      const text = node as TextNode;
      const classNames: string[] = placementClasses(text, placement, false);
      if (text.width) classNames.push(`w-[${text.width}px]`);
      if (text.height) classNames.push(`h-[${text.height}px]`);

      // Color
      const color = hexColor(text.fill);
      classNames.push(color ? `text-[${color}]` : 'text-zinc-100');

      // Typography
      if (text.fontSize) {
        classNames.push(`text-[${text.fontSize}px]`);
      }
      if (text.fontWeight) {
        const weight = String(text.fontWeight);
        if (weight === '700' || weight === 'bold') classNames.push('font-bold');
        else if (weight === '600' || weight === 'semibold') classNames.push('font-semibold');
        else if (weight === '500' || weight === 'medium') classNames.push('font-medium');
        else classNames.push('font-normal');
      }
      if (text.textAlign === 'center') classNames.push('text-center');
      else if (text.textAlign === 'right') classNames.push('text-right');

      const classAttr = classNames.length > 0 ? ` className="${classNames.join(' ')}"` : '';
      const tag = text.fontSize && text.fontSize >= 24 ? 'h2' : 'span';

      return `${indent}<${tag}${classAttr}>${jsxText(text.content || '')}</${tag}>`;
    }

    case 'path': {
      const pathNode = node as PathNode;
      const placed = placementClasses(pathNode, placement, false);
      const pathClass = placed.length > 0 ? ` className="${placed.join(' ')}"` : '';
      return `${indent}<svg${pathClass} width="${pathNode.width || 24}" height="${
        pathNode.height || 24
      }" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">\n${childIndent}<path d=${JSON.stringify(
        pathNode.geometry || ''
      )} stroke="${hexColor(pathNode.stroke) ?? 'currentColor'}" strokeWidth="${
        pathNode.strokeWidth || 2
      }" strokeLinecap="round" strokeLinejoin="round" />\n${indent}</svg>`;
    }

    case 'image': {
      const image = node as ImageNode;
      const classNames: string[] = placementClasses(image, placement, false);
      if (image.width) classNames.push(`w-[${image.width}px]`);
      if (image.height) classNames.push(`h-[${image.height}px]`);
      classNames.push(`object-${imageFit(image.fit)}`);
      if (image.cornerRadius) classNames.push(`rounded-[${image.cornerRadius}px]`);
      const src = safeImageSrc(image.src) ?? '';
      return `${indent}<img src=${JSON.stringify(src)} alt=${JSON.stringify(image.alt ?? image.name ?? '')} className="${classNames.join(' ')}" />`;
    }

    case 'rect':
    default: {
      const classNames: string[] = placementClasses(node, placement, false);
      if (node.width) classNames.push(`w-[${node.width}px]`);
      if (node.height) classNames.push(`h-[${node.height}px]`);
      const fill = hexColor(node.fill);
      if (fill) classNames.push(`bg-[${fill}]`);
      if (node.type === 'ellipse') classNames.push('rounded-full');
      else if (node.cornerRadius) classNames.push(`rounded-[${node.cornerRadius}px]`);
      const classAttr = classNames.length > 0 ? ` className="${classNames.join(' ')}"` : '';
      return `${indent}<div${classAttr} />`;
    }
  }
}

/**
 * Generates a full stand-alone React component module from a PenNode
 */
export function generateReactComponent(rootNode: PenNode, componentName: string = 'GeneratedDesign'): string {
  const jsxBody = compileAstToJsx(rootNode, 4);

  return `import React from 'react';

export function ${componentName}() {
  return (
${jsxBody}
  );
}

export default ${componentName};
`;
}
