import { PenDocument, PenNode } from '../../types/pen-ast';
import { parsePenDocument } from '../schema/pen-validator';

/**
 * Generates random 5-character ID matching pen.dev identifier style (e.g. "YKsGt", "AmD9T")
 */
export function generateNodeId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Serializes a PenDocument into deterministic formatted JSON suitable for git commits
 */
export function serializePenDocument(doc: PenDocument): string {
  return JSON.stringify(doc, null, 2) + '\n';
}

/**
 * Deserializes and validates raw JSON text into a typed PenDocument
 */
export function deserializePenDocument(jsonString: string): PenDocument {
  const parsed = JSON.parse(jsonString);
  return parsePenDocument(parsed) as PenDocument;
}

/**
 * Recursively searches a node tree for a specific node ID
 */
export function findNodeById(nodes: PenNode[], id: string): PenNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if ('children' in node && node.children && node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Recursively updates a node in the tree immutably
 */
export function updateNodeInTree(nodes: PenNode[], id: string, patch: Partial<PenNode>): PenNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, ...patch } as PenNode;
    }
    if ('children' in node && node.children && node.children.length > 0) {
      return {
        ...node,
        children: updateNodeInTree(node.children, id, patch),
      } as PenNode;
    }
    return node;
  });
}
