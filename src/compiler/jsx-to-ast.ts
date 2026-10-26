import { PenNode, FrameNode, TextNode } from '../types/pen-ast';
import { generateNodeId } from '../core/io/pen-file-handler';

/**
 * Lightweight parser that converts simple HTML/JSX structure into PenNode AST
 */
export function parseJsxToAst(jsxString: string): PenNode {
  const clean = jsxString.trim();

  // Check if it's text
  if (!clean.startsWith('<')) {
    return {
      id: generateNodeId(),
      type: 'text',
      name: 'Text',
      x: 0,
      y: 0,
      width: 160,
      height: 32,
      content: clean,
      fontSize: 16,
      fill: '#ffffff',
    } as TextNode;
  }

  // Detect button or container
  const isButton = clean.startsWith('<button');
  const isHeading = clean.startsWith('<h1') || clean.startsWith('<h2') || clean.startsWith('<h3');

  // Extract class names if any
  const classMatch = clean.match(/className=["']([^"']+)["']/);
  const classes = classMatch ? classMatch[1].split(/\s+/) : [];

  let fill = isButton ? '#ea580c' : '#18181b';
  let cornerRadius = 8;
  let layout: 'none' | 'flex' = 'none';
  let flexDirection: 'row' | 'column' = 'column';

  for (const cls of classes) {
    if (cls === 'flex') layout = 'flex';
    if (cls === 'flex-row') flexDirection = 'row';
    if (cls === 'flex-col') flexDirection = 'column';
    if (cls.startsWith('rounded-')) cornerRadius = 12;
    if (cls.startsWith('bg-[#') && cls.endsWith(']')) {
      fill = cls.slice(4, -1);
    }
  }

  // Extract text content between tags if simple
  const innerTextMatch = clean.match(/>([^<]+)<\//);
  const innerText = innerTextMatch ? innerTextMatch[1].trim() : null;

  if (innerText && !isButton && isHeading) {
    return {
      id: generateNodeId(),
      type: 'text',
      name: 'Heading',
      x: 0,
      y: 0,
      width: 320,
      height: 48,
      content: innerText,
      fontSize: 24,
      fontWeight: '700',
      fill: '#f4f4f5',
    } as TextNode;
  }

  const frameNode: FrameNode = {
    id: generateNodeId(),
    type: 'frame',
    name: isButton ? 'Button' : 'Container',
    x: 0,
    y: 0,
    width: isButton ? 180 : 360,
    height: isButton ? 48 : 240,
    fill,
    cornerRadius,
    layout,
    flexDirection,
    children: [],
  };

  if (innerText) {
    frameNode.children.push({
      id: generateNodeId(),
      type: 'text',
      name: 'Text',
      x: 0,
      y: 0,
      width: isButton ? 120 : 200,
      height: 24,
      content: innerText,
      fontSize: isButton ? 14 : 16,
      fontWeight: isButton ? '600' : '400',
      fill: '#ffffff',
      textAlign: isButton ? 'center' : 'left',
    } as TextNode);
  }

  return frameNode;
}
