import { describe, it, expect } from 'vitest';
import { PenMcpEngine } from '../../src/mcp/engine';
import { createPenMcpServer } from '../../src/mcp/server';
import { PenDocument } from '../../src/types/pen-ast';

describe('Pen MCP Server & Engine', () => {
  it('should return app state with nodes and variables', () => {
    const doc: PenDocument = {
      version: '2.13',
      children: [
        {
          id: 'box1',
          type: 'rect',
          name: 'Hero Rect',
          x: 10,
          y: 20,
          width: 200,
          height: 100,
        },
      ],
      variables: {
        '--primary': { type: 'color', value: '#3b82f6' },
      },
    };

    const engine = new PenMcpEngine(doc);
    const state = engine.getAppState();

    expect(state.version).toBe('2.13');
    expect(state.nodeCount).toBe(1);
    expect(state.children[0].id).toBe('box1');
    expect(state.variables['--primary']).toBeDefined();
  });

  it('should execute JS mutations to add nodes to canvas', () => {
    const engine = new PenMcpEngine();
    expect(engine.getDocument().children).toHaveLength(0);

    const res = engine.execute({
      description: 'Add a primary CTA button',
      input: `
        canvas.addNode({
          id: 'cta-btn',
          type: 'frame',
          name: 'Call to Action',
          fill: '#f97316',
          width: 160,
          height: 44
        });
      `,
    });

    expect(res.success).toBe(true);
    const doc = engine.getDocument();
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].id).toBe('cta-btn');
    expect(doc.children[0].fill).toBe('#f97316');
  });

  it('should import website URL into canvas frame', () => {
    const engine = new PenMcpEngine();
    const res = engine.importWebsite('https://example.com');

    expect(res.success).toBe(true);
    expect(res.importedNodeId).toBeDefined();

    const doc = engine.getDocument();
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].name).toContain('https://example.com');
  });

  it('should return design skills and rules', () => {
    const engine = new PenMcpEngine();
    const skill = engine.readSkill();

    expect(skill.skill).toBe('pen-design-agent');
    expect(skill.guidelines.length).toBeGreaterThan(0);
  });

  it('should initialize McpServer instance with all registered tools', () => {
    const { server } = createPenMcpServer();
    expect(server).toBeDefined();
  });
});
