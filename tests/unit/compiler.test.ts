import { describe, it, expect } from 'vitest';
import { compileAstToJsx, generateReactComponent } from '../../src/compiler/ast-to-jsx';
import { parseJsxToAst } from '../../src/compiler/jsx-to-ast';
import { FrameNode } from '../../src/types/pen-ast';

describe('Bidirectional Code Sync Compiler', () => {
  it('should compile an AST frame with flex layout and text into React Tailwind JSX', () => {
    const cardNode: FrameNode = {
      id: 'card1',
      type: 'frame',
      name: 'PricingCard',
      x: 0,
      y: 0,
      width: 300,
      height: 400,
      fill: '#18181b',
      stroke: '#3f3f46',
      cornerRadius: 16,
      layout: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: 24,
      children: [
        {
          id: 'title1',
          type: 'text',
          name: 'Title',
          x: 0,
          y: 0,
          width: 200,
          height: 32,
          content: 'Pro Tier',
          fontSize: 24,
          fontWeight: '700',
          fill: '#f97316',
        },
      ],
    };

    const jsx = compileAstToJsx(cardNode);
    expect(jsx).toContain('flex');
    expect(jsx).toContain('flex-col');
    expect(jsx).toContain('gap-[16px]');
    expect(jsx).toContain('p-[24px]');
    expect(jsx).toContain('bg-[#18181b]');
    expect(jsx).toContain('rounded-[16px]');
    expect(jsx).toContain('Pro Tier');

    const component = generateReactComponent(cardNode, 'PricingCard');
    expect(component).toContain('export function PricingCard()');
    expect(component).toContain('return (');
  });

  it('should parse JSX string into PenNode AST', () => {
    const snippet = '<button className="flex flex-col bg-[#ea580c] rounded-xl"><span>Sign Up</span></button>';
    const node = parseJsxToAst(snippet);

    expect(node.type).toBe('frame');
    expect(node.fill).toBe('#ea580c');
    expect((node as FrameNode).layout).toBe('flex');
    expect((node as FrameNode).children).toHaveLength(1);
    expect(((node as FrameNode).children[0] as any).content).toBe('Sign Up');
  });
});

describe('JSX export positioning', () => {
  const page: FrameNode = {
    id: 'page',
    type: 'frame',
    name: 'Landing',
    x: 400,
    y: 120,
    width: 1280,
    height: 800,
    fill: '#0b0c10',
    children: [
      {
        id: 'hero',
        type: 'frame',
        x: 40,
        y: 60,
        width: 600,
        height: 300,
        children: [{ id: 't', type: 'text', x: 24, y: 32, width: 500, height: 48, content: 'Giá {sale} <50%>' }],
      },
      { id: 'bar', type: 'rect', x: 0, y: 780, width: 1280, height: 20, fill: '#f97316' },
    ],
  };

  it('keeps canvas x/y for children of free-form frames', () => {
    const jsx = compileAstToJsx(page);
    expect(jsx).toMatch(/^\s*<div className="relative w-\[1280px\]/);
    expect(jsx).not.toContain('left-[400px]');
    expect(jsx).toContain('absolute left-[40px] top-[60px] w-[600px] h-[300px]');
    expect(jsx).toContain('absolute left-[24px] top-[32px] w-[500px] h-[48px]');
    expect(jsx).toContain('absolute left-[0px] top-[780px]');
  });

  it('escapes text that would break JSX', () => {
    expect(compileAstToJsx(page)).toContain('{"Giá {sale} <50%>"}');
  });
});

describe('JSX image export', () => {
  it('emits an <img> with a quoted source and placement classes', () => {
    const jsx = compileAstToJsx(
      { id: 'i', type: 'image', name: 'Hero', x: 8, y: 16, width: 200, height: 100, src: 'https://cdn.test/h.png', fit: 'contain', cornerRadius: 12 },
      0,
      'absolute'
    );
    expect(jsx).toBe(
      '<img src="https://cdn.test/h.png" alt="Hero" className="absolute left-[8px] top-[16px] w-[200px] h-[100px] object-contain rounded-[12px]" />'
    );
  });

  it('drops unsafe sources', () => {
    const jsx = compileAstToJsx({ id: 'i', type: 'image', src: 'javascript:alert(1)', fit: 'evil" onload="x' as never }, 0);
    expect(jsx).toContain('src=""');
    expect(jsx).toContain('object-cover');
    expect(jsx).not.toContain('onload');
  });
});

describe('JSX flip', () => {
  it('adds flip classes to JSX', () => {
    expect(compileAstToJsx({ id: 'r', type: 'rect', width: 10, height: 10, flipX: true })).toContain('-scale-x-100');
    expect(compileAstToJsx({ id: 'r', type: 'rect', width: 10, height: 10, flipY: true })).toContain('-scale-y-100');
  });
});
