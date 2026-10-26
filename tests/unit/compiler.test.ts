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
