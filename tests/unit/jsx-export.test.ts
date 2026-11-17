import { describe, it, expect } from 'vitest';
import { buildJsxExport, toComponentName } from '../../src/compiler/jsx-export';
import { PenDocument } from '../../src/types/pen-ast';

const doc: PenDocument = {
  version: '2.13',
  children: [
    { id: 'f1', type: 'frame', name: '1. Neon Glass', children: [] },
    { id: 'f2', type: 'frame', name: 'Pricing', fill: '#123456', children: [] },
  ],
};

describe('toComponentName', () => {
  it('produces a valid PascalCase identifier', () => {
    expect(toComponentName('landing page')).toBe('LandingPage');
    expect(toComponentName('1. Neon Glass')).toBe('Design1NeonGlass');
    expect(toComponentName('***')).toBe('GeneratedDesign');
  });
});

describe('buildJsxExport', () => {
  it('returns null for an empty canvas', () => {
    expect(buildJsxExport({ version: '2.13', children: [] }, [], 'untitled.pen')).toBeNull();
  });

  it('exports the selected node under its own name', () => {
    const result = buildJsxExport(doc, ['f2'], 'landing.pen');
    expect(result?.filename).toBe('Pricing.tsx');
    expect(result?.content).toContain('export function Pricing()');
  });

  it('exports the whole canvas named after the document when nothing is selected', () => {
    const result = buildJsxExport(doc, [], 'landing.pen');
    expect(result?.filename).toBe('Landing.tsx');
    expect(result?.content).toContain('export function Landing()');
    expect(result?.content).toContain('bg-[#123456]');
  });

  it('sizes the whole-canvas wrapper and moves nodes to its origin', () => {
    const placed: PenDocument = {
      version: '2.13',
      children: [
        { id: 'a', type: 'frame', name: 'A', x: 80, y: 80, width: 1280, height: 720, children: [] },
        { id: 'b', type: 'frame', name: 'B', x: 1440, y: 80, width: 400, height: 300, children: [] },
      ],
    };
    const content = buildJsxExport(placed, [], 'landing.pen')?.content ?? '';
    expect(content).toContain('relative w-[1760px] h-[720px]');
    expect(content).toContain('absolute left-[0px] top-[0px] w-[1280px]');
    expect(content).toContain('absolute left-[1360px] top-[0px] w-[400px]');
  });
});

describe('component instances', () => {
  it('exports an instance with its master content', () => {
    const withInstance: PenDocument = {
      version: '2.13',
      children: [
        { id: 'btn', type: 'frame', name: 'Button', reusable: true, fill: '#7c3aed', children: [] },
        {
          id: 'page',
          type: 'frame',
          name: 'Page',
          children: [{ id: 'inst', type: 'component', componentId: 'btn', x: 20, y: 30, width: 120, height: 40 }],
        },
      ],
    };
    expect(buildJsxExport(withInstance, ['page'], 'x.pen')?.content).toContain('bg-[#7c3aed]');
  });
});
