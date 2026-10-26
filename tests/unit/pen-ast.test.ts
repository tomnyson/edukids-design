import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { deserializePenDocument, serializePenDocument, findNodeById, updateNodeInTree, generateNodeId } from '../../src/core/io/pen-file-handler';
import { PenDocument } from '../../src/types/pen-ast';

describe('Pen AST & Schema Validation', () => {
  it('should parse reverse-engineered pencil-welcome.pen document correctly', () => {
    const filePath = path.resolve(__dirname, '../../docs/specs/reverse-engineered/pencil-welcome.pen');
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    
    const doc = deserializePenDocument(rawContent);
    expect(doc.version).toBe('2.13');
    expect(doc.children.length).toBeGreaterThan(0);
    
    const rootFrame = doc.children[0];
    expect(rootFrame.type).toBe('frame');
    expect(rootFrame.id).toBe('YKsGt');
    expect(rootFrame.name).toBe('Welcome to pen.dev');
    
    // Check variables
    expect(doc.variables).toBeDefined();
    expect(doc.variables?.['--sidebar']).toBeDefined();
  });

  it('should generate valid 5-character alphanumeric node IDs', () => {
    const id = generateNodeId();
    expect(id).toHaveLength(5);
    expect(/^[A-Za-z0-9]{5}$/.test(id)).toBe(true);
  });

  it('should locate nested nodes by ID', () => {
    const sampleDoc: PenDocument = {
      version: '2.13',
      children: [
        {
          id: 'root1',
          type: 'frame',
          name: 'Screen',
          x: 0,
          y: 0,
          width: 800,
          height: 600,
          children: [
            {
              id: 'childText',
              type: 'text',
              name: 'Title',
              x: 20,
              y: 20,
              width: 200,
              height: 40,
              content: 'Hello World',
            },
          ],
        },
      ],
    };

    const found = findNodeById(sampleDoc.children, 'childText');
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Title');
    expect((found as any).content).toBe('Hello World');
  });

  it('should update nodes immutably', () => {
    const sampleDoc: PenDocument = {
      version: '2.13',
      children: [
        {
          id: 'btn1',
          type: 'frame',
          name: 'Button',
          x: 10,
          y: 10,
          width: 120,
          height: 40,
          fill: '#3b82f6',
          children: [],
        },
      ],
    };

    const updated = updateNodeInTree(sampleDoc.children, 'btn1', { fill: '#ef4444' });
    expect(updated[0].fill).toBe('#ef4444');
    expect(sampleDoc.children[0].fill).toBe('#3b82f6'); // original untouched
  });

  it('should serialize and round-trip deterministic JSON', () => {
    const sampleDoc: PenDocument = {
      version: '2.13',
      children: [
        {
          id: 'box1',
          type: 'rect',
          name: 'Rectangle',
          x: 50,
          y: 50,
          width: 100,
          height: 100,
        },
      ],
    };

    const serialized = serializePenDocument(sampleDoc);
    const parsed = deserializePenDocument(serialized);
    expect(parsed).toEqual(sampleDoc);
  });
});
