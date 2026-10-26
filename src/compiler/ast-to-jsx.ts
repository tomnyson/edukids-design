import { PenNode, FrameNode, TextNode, PathNode } from '../types/pen-ast';

/**
 * Converts a PenNode AST into semantic React JSX string styled with Tailwind CSS
 */
export function compileAstToJsx(node: PenNode, indentLevel: number = 2): string {
  const indent = ' '.repeat(indentLevel);
  const childIndent = ' '.repeat(indentLevel + 2);

  switch (node.type) {
    case 'frame': {
      const frame = node as FrameNode;
      const classNames: string[] = [];

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
        if (frame.fill.startsWith('#')) {
          classNames.push(`bg-[${frame.fill}]`);
        } else {
          classNames.push('bg-zinc-900');
        }
      }

      // Border & Radius
      if (frame.stroke) {
        classNames.push(`border border-[${frame.stroke}]`);
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

      const childrenJsx = frame.children
        .map((child) => compileAstToJsx(child, indentLevel + 2))
        .join('\n');

      return `${indent}<${tag}${classAttr}>\n${childrenJsx}\n${indent}</${tag}>`;
    }

    case 'text': {
      const text = node as TextNode;
      const classNames: string[] = [];

      // Color
      if (text.fill && text.fill.startsWith('#')) {
        classNames.push(`text-[${text.fill}]`);
      } else {
        classNames.push('text-zinc-100');
      }

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

      return `${indent}<${tag}${classAttr}>${text.content || ''}</${tag}>`;
    }

    case 'path': {
      const pathNode = node as PathNode;
      return `${indent}<svg width="${pathNode.width || 24}" height="${
        pathNode.height || 24
      }" viewBox="0 0 100 100" fill="none">\n${childIndent}<path d="${
        pathNode.geometry || ''
      }" stroke="${pathNode.stroke || 'currentColor'}" strokeWidth="${
        pathNode.strokeWidth || 2
      }" strokeLinecap="round" strokeLinejoin="round" />\n${indent}</svg>`;
    }

    case 'rect':
    default: {
      const classNames: string[] = [];
      if (node.width) classNames.push(`w-[${node.width}px]`);
      if (node.height) classNames.push(`h-[${node.height}px]`);
      if (node.fill && node.fill.startsWith('#')) classNames.push(`bg-[${node.fill}]`);
      if (node.cornerRadius) classNames.push(`rounded-[${node.cornerRadius}px]`);
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
