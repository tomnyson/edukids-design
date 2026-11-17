import { PenDocument, PenNode } from '../types/pen-ast';
import { findNodeById } from '../core/io/pen-file-handler';
import { generateReactComponent } from './ast-to-jsx';
import { canvasRoot } from './ast-to-html';
import { expandInstances } from '../lib/components';

export interface JsxExport {
  filename: string;
  content: string;
}

/**
 * Turns an arbitrary layer/document name into a valid PascalCase identifier
 */
export function toComponentName(name: string): string {
  const pascal = name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  if (!pascal) return 'GeneratedDesign';
  return /^[0-9]/.test(pascal) ? `Design${pascal}` : pascal;
}

/**
 * Builds a .tsx module for the selected node, or for the whole canvas when
 * nothing is selected. Returns null when there is nothing to export.
 */
export function buildJsxExport(doc: PenDocument, selectedNodeIds: string[], documentName: string): JsxExport | null {
  const selected = selectedNodeIds.length > 0 ? findNodeById(doc.children, selectedNodeIds[0]) : null;
  if (!selected && doc.children.length === 0) return null;

  // Whole canvas: one wrapper sized to the bounding box, with nodes moved to its origin.
  // Instances export as the master content they show.
  const [root]: (PenNode | undefined)[] = selected
    ? expandInstances([selected], doc.children)
    : [canvasRoot(expandInstances(doc.children, doc.children), documentName.replace(/\.pen$/i, ''))];
  if (!root) return null;

  const componentName = toComponentName(root.name || 'GeneratedDesign');
  return {
    filename: `${componentName}.tsx`,
    content: generateReactComponent(root, componentName),
  };
}
