import type { CSSProperties } from 'react';
import { PenDocument, PenNode, FrameNode, TextNode, PathNode, ImageNode } from '../types/pen-ast';
import { findNodeById } from '../core/io/pen-file-handler';
import { imageFit, safeImageSrc } from '../lib/image-source';
import { expandInstances } from '../lib/components';
import {
  boxStyle,
  effectStyle,
  FlowLayout,
  fontFamiliesIn,
  frameLayoutStyle,
  googleFontsUrl,
  layoutOf,
  paintStyle,
  textStyle,
} from '../components/canvas/node-style';

/**
 * Compiles a PenNode tree into static HTML that looks like the canvas: it
 * reuses the canvas styles, so flex frames place their children and sizes
 * follow the layout exactly as NodeRenderer draws them. Used by Preview,
 * Export HTML, Copy as HTML, PNG export and the exported page of Share.
 */

export interface HtmlExport {
  filename: string;
  content: string;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

// Colors, gradients, lengths and keywords only: no `;`, `:`, quotes or `url(` from untrusted .pen files
const SAFE_CSS_VALUE = /^[#\w\s(),.%-]+$/;
/** The one quoted value: a font stack built by fontStack from a checked family name */
const FONT_STACK = /^"[A-Za-z0-9 ]+", (sans-serif|monospace)$/;

/** Fill of a shape drawn without one, as on the canvas */
const DEFAULT_SHAPE_FILL = '#3f3f46';
const IMAGE_PLACEHOLDER_FILL = '#27272a';

function cssValue(property: string, value: unknown): string | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const trimmed = value.trim();
  if (property === 'font-family' && FONT_STACK.test(trimmed)) return trimmed;
  return SAFE_CSS_VALUE.test(trimmed) && !/url\s*\(/i.test(trimmed) ? trimmed : undefined;
}

const kebabCase = (property: string) => property.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);

/** A style attribute; values that are not plainly safe CSS are dropped */
function styleAttr(style: CSSProperties): string {
  const css = Object.entries(style)
    .map(([property, value]) => {
      const name = kebabCase(property);
      const safe = cssValue(name, value);
      return safe === undefined ? undefined : `${name}:${safe}`;
    })
    .filter((declaration) => declaration !== undefined)
    .join(';');
  return ` style="${escapeHtml(css)}"`;
}

/** Where the node sits: the root is pinned at the origin of the page */
function placeStyle(node: PenNode, isRoot: boolean, parent: FlowLayout | undefined): CSSProperties {
  const box = boxStyle(node, isRoot ? undefined : parent);
  return isRoot ? { ...box, position: 'relative', left: '0px', top: '0px' } : box;
}

function renderFrame(frame: FrameNode, place: CSSProperties): string {
  const flow = layoutOf(frame);
  const children = (frame.children ?? []).map((child) => renderNodeHtml(child, false, flow)).join('');
  const style = styleAttr({ ...place, ...paintStyle(frame), ...effectStyle(frame), ...frameLayoutStyle(frame) });
  return `<div${style}>${children}</div>`;
}

function renderText(text: TextNode, place: CSSProperties): string {
  // Copied markup stays selectable, unlike the canvas
  const { userSelect: _canvasOnly, ...typography } = textStyle(text);
  const style = styleAttr({ ...place, ...typography, ...effectStyle(text), margin: '0' });
  return `<p${style}>${escapeHtml(text.content || '')}</p>`;
}

function renderPath(path: PathNode, place: CSSProperties): string {
  const color = (value: string | undefined, fallback: string) => cssValue('fill', value) ?? fallback;
  const attrs = [
    `d="${escapeHtml(path.geometry || '')}"`,
    `fill="${escapeHtml(color(path.fill, 'none'))}"`,
    `stroke="${escapeHtml(color(path.stroke, '#f97316'))}"`,
    `stroke-width="${path.strokeWidth || 2}"`,
    `stroke-linecap="${path.strokeLinecap || 'round'}"`,
    `stroke-linejoin="${path.strokeLinejoin || 'round'}"`,
  ].join(' ');
  return (
    `<div${styleAttr({ ...place, ...effectStyle(path) })}>` +
    `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="overflow:visible"><path ${attrs}/></svg>` +
    `</div>`
  );
}

function renderImage(image: ImageNode, place: CSSProperties): string {
  const src = safeImageSrc(image.src);
  const box: CSSProperties = { ...place, ...paintStyle(image), ...effectStyle(image) };
  // A missing or unsafe source keeps its box as a neutral placeholder
  if (!src) return `<div${styleAttr({ ...box, backgroundColor: IMAGE_PLACEHOLDER_FILL })}></div>`;
  const style = styleAttr({ ...box, display: box.display ?? 'block', objectFit: imageFit(image.fit) });
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(image.alt ?? image.name ?? '')}"${style}>`;
}

/** Keeps the icon's place in the layout; its glyph is not drawn in static HTML */
function renderIcon(node: PenNode, place: CSSProperties): string {
  return `<div${styleAttr({ ...place, ...effectStyle(node) })}></div>`;
}

function renderShape(node: PenNode, place: CSSProperties): string {
  const unpainted = !node.fill && !node.stroke;
  const paint = paintStyle(unpainted ? { ...node, fill: DEFAULT_SHAPE_FILL } : node);
  return `<div${styleAttr({ ...place, ...paint, ...effectStyle(node) })}></div>`;
}

/** One node and its subtree; `parent` is the flow layout of the frame holding it */
export function renderNodeHtml(node: PenNode, isRoot: boolean = false, parent?: FlowLayout): string {
  if (node.visible === false) return '';
  const place = placeStyle(node, isRoot, parent);
  switch (node.type) {
    case 'frame':
      return renderFrame(node as FrameNode, place);
    case 'text':
      return renderText(node as TextNode, place);
    case 'path':
      return renderPath(node as PathNode, place);
    case 'image':
      return renderImage(node as ImageNode, place);
    case 'icon':
      return renderIcon(node, place);
    default:
      return renderShape(node, place);
  }
}

/**
 * Stylesheet links for the Google Fonts the tree uses; names that are not
 * plain family names get none. Google rejects a request for weights a family
 * lacks, and a static page cannot retry, so the regular weight is linked too.
 */
function fontLinks(root: PenNode): string {
  return fontFamiliesIn([root])
    .flatMap((family) => [googleFontsUrl(family), googleFontsUrl(family, false)])
    .filter((url): url is string => url !== undefined)
    .map((url) => `<link rel="stylesheet" href="${escapeHtml(url)}">\n`)
    .join('');
}

/** Standalone page with no scripts, safe to open from a blob URL or a sandboxed iframe */
export function buildHtmlDocument(root: PenNode, title: string = root.name || 'Design'): string {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${fontLinks(root)}<style>*{box-sizing:border-box}html,body{margin:0;background:#0c0d12;font-family:Inter,system-ui,-apple-system,sans-serif}</style>
</head>
<body>
${renderNodeHtml(root, true)}
</body>
</html>
`;
}

/** Wraps all top-level nodes in one frame sized to their bounding box */
export function canvasRoot(nodes: PenNode[], name: string): FrameNode {
  const visible = nodes.filter((n) => n.visible !== false);
  const minX = Math.min(...visible.map((n) => n.x ?? 0));
  const minY = Math.min(...visible.map((n) => n.y ?? 0));
  const maxX = Math.max(...visible.map((n) => (n.x ?? 0) + (n.width ?? 0)));
  const maxY = Math.max(...visible.map((n) => (n.y ?? 0) + (n.height ?? 0)));
  return {
    id: 'canvas-root',
    type: 'frame',
    name,
    width: maxX - minX,
    height: maxY - minY,
    layout: 'none',
    children: visible.map((n) => ({ ...n, x: (n.x ?? 0) - minX, y: (n.y ?? 0) - minY }) as PenNode),
  };
}

/** Id of the top-level node that contains `id`, or null when it is not in the tree */
export function findTopLevelId(nodes: PenNode[], id: string): string | null {
  const top = nodes.find((n) => n.id === id || findNodeById([n], id) !== null);
  return top?.id ?? null;
}

function baseName(documentName: string): string {
  return documentName.replace(/\.pen$/i, '') || 'design';
}

function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'design';
}

export interface ExportTarget {
  root: PenNode;
  name: string;
  /** File name without extension */
  basename: string;
}

/**
 * What an export covers: the selected node, or the whole canvas when nothing
 * is selected. Returns null when there is nothing to export.
 */
export function resolveExportTarget(
  doc: PenDocument,
  selectedNodeIds: string[],
  documentName: string
): ExportTarget | null {
  const selected = selectedNodeIds.length > 0 ? findNodeById(doc.children, selectedNodeIds[0]) : null;
  if (!selected && doc.children.length === 0) return null;

  const name = selected?.name || baseName(documentName);
  // Instances export as the master content they show
  const [root] = selected
    ? expandInstances([selected], doc.children)
    : [canvasRoot(expandInstances(doc.children, doc.children), name)];
  if (!root) return null;
  return { root, name, basename: safeFilename(name) };
}

/** Builds a .html page for the selected node, or for the whole canvas when nothing is selected */
export function buildHtmlExport(doc: PenDocument, selectedNodeIds: string[], documentName: string): HtmlExport | null {
  const target = resolveExportTarget(doc, selectedNodeIds, documentName);
  if (!target) return null;
  return {
    filename: `${target.basename}.html`,
    content: buildHtmlDocument(target.root, target.name),
  };
}
