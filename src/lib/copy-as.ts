import { PenNode } from '../types/pen-ast';
import { generateReactComponent } from '../compiler/ast-to-jsx';
import { toComponentName } from '../compiler/jsx-export';
import { buildHtmlDocument, canvasRoot } from '../compiler/ast-to-html';
import { dataUrlToBlob, renderPng } from './frame-export';

export type CopyFormat = 'json' | 'jsx' | 'html' | 'png';

const NOTHING_TO_COPY = 'Không có layer để copy';
const CLIPBOARD_BLOCKED = 'Trình duyệt chặn clipboard';
const PNG_RENDER_FAILED = 'Không xuất được PNG';
const SELECTION_NAME = 'Selection';

/** One root for the rendered formats: the node itself, or a frame holding the whole selection */
function copyRoot(nodes: PenNode[]): PenNode {
  return nodes.length === 1 ? nodes[0] : canvasRoot(nodes, SELECTION_NAME);
}

export function copyAsText(format: Exclude<CopyFormat, 'png'>, nodes: PenNode[]): string {
  switch (format) {
    case 'json':
      return JSON.stringify(nodes.length === 1 ? nodes[0] : nodes, null, 2);
    case 'jsx': {
      const root = copyRoot(nodes);
      return generateReactComponent(root, toComponentName(root.name ?? root.id));
    }
    case 'html': {
      const root = copyRoot(nodes);
      return buildHtmlDocument(root, root.name);
    }
  }
}

/**
 * Writes the nodes to the system clipboard. Throws a user-facing message when
 * there is nothing to copy or the browser refuses clipboard access.
 */
export async function copyNodesAs(
  format: CopyFormat,
  nodes: PenNode[],
  clipboard: Clipboard | undefined = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
): Promise<void> {
  if (nodes.length === 0) throw new Error(NOTHING_TO_COPY);
  if (!clipboard) throw new Error(CLIPBOARD_BLOCKED);
  // A failed render is the design's fault, not the clipboard's, so it keeps its own message
  let renderError: unknown = null;
  try {
    if (format === 'png') {
      // Hand the clipboard a pending blob so Safari still counts the write as part of the click
      const blob = renderPng(copyRoot(nodes))
        .then(({ dataUrl }) => dataUrlToBlob(dataUrl))
        .catch((error: unknown) => {
          renderError = error;
          throw error;
        });
      await clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } else {
      await clipboard.writeText(copyAsText(format, nodes));
    }
  } catch (error: unknown) {
    if (renderError instanceof Error) throw renderError;
    if (renderError !== null) throw new Error(PNG_RENDER_FAILED, { cause: renderError });
    throw new Error(CLIPBOARD_BLOCKED, { cause: error });
  }
}
