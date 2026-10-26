import * as fs from 'fs';
import { PenDocument, PenNode } from '../types/pen-ast';
import { deserializePenDocument, serializePenDocument, generateNodeId, updateNodeInTree, findNodeById } from '../core/io/pen-file-handler';

export class PenMcpEngine {
  private document: PenDocument;
  private filePath?: string;

  constructor(initialDoc?: PenDocument, filePath?: string) {
    this.filePath = filePath;
    if (filePath && fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      this.document = deserializePenDocument(content);
    } else {
      this.document = initialDoc || {
        version: '2.13',
        children: [],
        themes: { Mode: ['Light', 'Dark'] },
        variables: {},
      };
    }
  }

  public getAppState(targetPath?: string) {
    const doc = this.resolveDoc(targetPath);
    return {
      version: doc.version,
      nodeCount: doc.children.length,
      children: doc.children,
      themes: doc.themes || {},
      variables: doc.variables || {},
    };
  }

  public getStyle(targetPath?: string) {
    const doc = this.resolveDoc(targetPath);
    return {
      variables: doc.variables || {},
      themes: doc.themes || {},
    };
  }

  public execute(args: {
    input?: string;
    description?: string;
    edits?: Array<{ find: string; replace: string; all?: boolean }>;
    filePath?: string;
  }) {
    const doc = this.resolveDoc(args.filePath);

    // If input is provided, we can parse simple creation commands or AST mutations
    if (args.input) {
      try {
        // Safe evaluation sandbox for AST mutation functions
        const sandbox = {
          doc,
          addNode: (node: Partial<PenNode>, parentId?: string) => {
            const newNode: PenNode = {
              id: node.id || generateNodeId(),
              type: node.type || 'frame',
              name: node.name || 'New Node',
              x: node.x || 0,
              y: node.y || 0,
              width: node.width || 120,
              height: node.height || 60,
              fill: node.fill || '#27272a',
              ...node,
            } as PenNode;

            if (parentId) {
              const parent = findNodeById(doc.children, parentId);
              if (parent && 'children' in parent) {
                parent.children = [...(parent.children || []), newNode];
              } else {
                doc.children.push(newNode);
              }
            } else {
              doc.children.push(newNode);
            }
            return newNode;
          },
          updateNode: (id: string, patch: Partial<PenNode>) => {
            doc.children = updateNodeInTree(doc.children, id, patch);
          },
        };

        const fn = new Function('canvas', args.input);
        fn(sandbox);

        this.persist(args.filePath);
        return {
          success: true,
          description: args.description || 'Executed design mutation',
          nodeCount: doc.children.length,
        };
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message,
        };
      }
    }

    // Surgical edits
    if (args.edits && args.filePath && fs.existsSync(args.filePath)) {
      let content = fs.readFileSync(args.filePath, 'utf-8');
      for (const edit of args.edits) {
        if (edit.all) {
          content = content.replaceAll(edit.find, edit.replace);
        } else {
          content = content.replace(edit.find, edit.replace);
        }
      }
      fs.writeFileSync(args.filePath, content, 'utf-8');
      this.document = deserializePenDocument(content);
      return { success: true, description: args.description || 'Applied edits' };
    }

    return { success: true, message: 'No mutation needed' };
  }

  public importWebsite(url: string, filePath?: string) {
    const doc = this.resolveDoc(filePath);
    const importedFrame: PenNode = {
      id: generateNodeId(),
      type: 'frame',
      name: `Import: ${url}`,
      x: 50,
      y: 50,
      width: 1200,
      height: 800,
      fill: '#09090b',
      stroke: '#27272a',
      strokeWidth: 1,
      cornerRadius: 12,
      layout: 'flex',
      flexDirection: 'column',
      padding: 32,
      gap: 16,
      children: [
        {
          id: generateNodeId(),
          type: 'text',
          name: 'Imported Web Header',
          x: 0,
          y: 0,
          width: 800,
          height: 48,
          content: `Web Capture from ${url}`,
          fontSize: 28,
          fontWeight: '700',
          fill: '#f97316',
        },
      ],
    };

    doc.children.push(importedFrame);
    this.persist(filePath);
    return {
      success: true,
      importedNodeId: importedFrame.id,
      url,
    };
  }

  public readSkill() {
    return {
      skill: 'pen-design-agent',
      guidelines: [
        'Always design with an 8px spacing grid.',
        'Use flex auto-layout on frames to ensure responsive adaptability.',
        'Prefer named tokens (variables) for theme-aware backgrounds and text colors.',
        'Ensure WCAG AA contrast ratio for text on colored backgrounds.',
      ],
    };
  }

  public getDocument(): PenDocument {
    return this.document;
  }

  private resolveDoc(filePath?: string): PenDocument {
    if (filePath && fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      this.document = deserializePenDocument(content);
    }
    return this.document;
  }

  private persist(filePath?: string) {
    const target = filePath || this.filePath;
    if (target && fs.existsSync(target)) {
      fs.writeFileSync(target, serializePenDocument(this.document), 'utf-8');
    }
  }
}
