import type { CSSProperties } from 'react';
import { FrameNode, PenEffect, PenNode, Sizing, TextNode } from '../../types/pen-ast';
import { isLayeredPaint } from '../../core/io/pen-format/paint';
import { nodeTransform } from '../../lib/node-transform';

/**
 * CSS for drawing nodes on the canvas the way pen.dev lays them out: flex
 * frames place their children, sizes can follow the layout, and fills,
 * borders and effects keep pen.dev's richer forms.
 */

/** How a frame places its children; undefined when they sit at their own x/y */
export interface FlowLayout {
  direction: 'row' | 'column';
}

export function layoutOf(node: PenNode): FlowLayout | undefined {
  if (node.type !== 'frame' || node.layout !== 'flex') return undefined;
  return { direction: node.flexDirection === 'column' ? 'column' : 'row' };
}

const px = (value: number) => `${value}px`;

/** One axis of a node's size inside its parent */
function axisStyle(
  axis: 'width' | 'height',
  size: number | undefined,
  sizing: Sizing | undefined,
  parent: FlowLayout | undefined
): CSSProperties {
  if (sizing === 'fit_content') return {};
  if (sizing === 'fill_container') {
    if (!parent) return { [axis]: '100%' };
    const main = (parent.direction === 'row') === (axis === 'width');
    if (!main) return { alignSelf: 'stretch' };
    return { flex: '1 1 0', [axis === 'width' ? 'minWidth' : 'minHeight']: 0 };
  }
  return size === undefined ? {} : { [axis]: px(size) };
}

/** Where a node sits and how big it is, given the layout of its parent */
export function boxStyle(node: PenNode, parent?: FlowLayout): CSSProperties {
  const inFlow = parent !== undefined && node.layoutPosition !== 'absolute';
  const flow = inFlow ? parent : undefined;
  return {
    ...(inFlow
      ? { position: 'relative', flexShrink: 0 }
      : { position: 'absolute', left: px(node.x ?? 0), top: px(node.y ?? 0) }),
    ...axisStyle('width', node.width, node.widthSizing, flow),
    ...axisStyle('height', node.height, node.heightSizing, flow),
    boxSizing: 'border-box',
    transform: nodeTransform(node),
    opacity: node.opacity ?? 1,
    display: node.visible === false ? 'none' : undefined,
  };
}

const JUSTIFY: Record<NonNullable<FrameNode['justifyContent']>, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
};

const ALIGN: Record<NonNullable<FrameNode['alignItems']>, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

function paddingCss(padding: FrameNode['padding']): string | undefined {
  if (typeof padding === 'number') return px(padding);
  return Array.isArray(padding) ? padding.map(px).join(' ') : undefined;
}

/** How a frame arranges what is inside it */
export function frameLayoutStyle(frame: FrameNode): CSSProperties {
  const flow = layoutOf(frame);
  return {
    display: flow ? 'flex' : 'block',
    flexDirection: flow?.direction,
    gap: flow && frame.gap ? px(frame.gap) : undefined,
    padding: paddingCss(frame.padding),
    justifyContent: flow ? JUSTIFY[frame.justifyContent ?? 'start'] : undefined,
    alignItems: flow ? ALIGN[frame.alignItems ?? 'start'] : undefined,
    overflow: frame.clip ? 'hidden' : 'visible',
  };
}

/** True for nodes whose fill colours their glyphs, not a box */
const isGlyph = (node: PenNode) => node.type === 'text' || node.type === 'icon';

function fillStyle(fill: string | undefined): CSSProperties {
  if (!fill) return {};
  return isLayeredPaint(fill) ? { background: fill } : { backgroundColor: fill };
}

function borderStyle(node: PenNode): CSSProperties {
  if (!node.stroke) return {};
  const sides = node.strokeWidths;
  if (!sides) return { border: `${px(node.strokeWidth ?? 1)} solid ${node.stroke}` };
  return {
    borderStyle: 'solid',
    borderColor: node.stroke,
    borderWidth: [sides.top, sides.right, sides.bottom, sides.left].map((side) => px(side ?? 0)).join(' '),
  };
}

function radiusCss(node: PenNode): string | undefined {
  if (node.type === 'ellipse') return '50%';
  if (node.cornerRadii) return node.cornerRadii.map(px).join(' ');
  return node.cornerRadius ? px(node.cornerRadius) : undefined;
}

/** Background, border and corner rounding of a node's box */
export function paintStyle(node: PenNode): CSSProperties {
  return {
    ...(isGlyph(node) ? {} : fillStyle(node.fill)),
    ...borderStyle(node),
    borderRadius: radiusCss(node),
  };
}

function shadowCss(effect: PenEffect, withSpread: boolean): string {
  const { x = 0, y = 0 } = effect.offset ?? {};
  const parts = [px(x), px(y), px(effect.blur ?? 0), ...(withSpread ? [px(effect.spread ?? 0)] : [])];
  return `${parts.join(' ')} ${effect.color ?? '#00000040'}`;
}

/** Shadows and blurs; text and icons get drop-shadow so the shadow follows their glyphs */
export function effectStyle(node: PenNode): CSSProperties {
  const effects = (node.effects ?? []).filter((effect) => effect.enabled !== false);
  const shadows = effects.filter((effect) => effect.type === 'shadow');
  const blur = effects.find((effect) => effect.type === 'blur');
  const backdrop = effects.find((effect) => effect.type === 'background_blur');
  const glyph = isGlyph(node);
  const filters = [
    ...(glyph ? shadows.map((effect) => `drop-shadow(${shadowCss(effect, false)})`) : []),
    ...(blur ? [`blur(${px(blur.radius ?? 0)})`] : []),
  ];
  const boxShadows = glyph
    ? []
    : shadows.map((effect) => `${effect.shadowType === 'inner' ? 'inset ' : ''}${shadowCss(effect, true)}`);
  return {
    ...(boxShadows.length > 0 ? { boxShadow: boxShadows.join(', ') } : {}),
    ...(filters.length > 0 ? { filter: filters.join(' ') } : {}),
    ...(backdrop ? { backdropFilter: `blur(${px(backdrop.radius ?? 0)})` } : {}),
  };
}

const GENERIC_FONTS = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'inherit']);
/** A single family name, safe to put in a URL or a quoted CSS string */
const FAMILY_NAME = /^[A-Za-z0-9][A-Za-z0-9 ]*$/;

/** A file's font family as a CSS stack that falls back to a font of the same kind */
export function fontStack(family: string | undefined): string {
  if (!family) return 'inherit';
  if (!FAMILY_NAME.test(family) || GENERIC_FONTS.has(family)) return family;
  return `"${family}", ${/mono|code/i.test(family) ? 'monospace' : 'sans-serif'}`;
}

/** Google Fonts stylesheet for one family, in the weights the app offers or only its regular one */
export function googleFontsUrl(family: string, allWeights = true): string | undefined {
  if (!FAMILY_NAME.test(family) || GENERIC_FONTS.has(family)) return undefined;
  const weights = allWeights ? ':wght@300;400;500;600;700' : '';
  return `https://fonts.googleapis.com/css2?family=${family.trim().replace(/ +/g, '+')}${weights}&display=swap`;
}

/** Every font family the nodes use, instance overrides included, each once in tree order */
export function fontFamiliesIn(nodes: readonly PenNode[]): string[] {
  const found = new Set<string>();
  const visit = (node: Partial<PenNode> & Record<string, unknown>) => {
    if (typeof node.fontFamily === 'string' && node.fontFamily) found.add(node.fontFamily);
    if (Array.isArray(node.children)) node.children.forEach(visit);
    if (node.descendants && typeof node.descendants === 'object') Object.values(node.descendants).forEach(visit);
  };
  nodes.forEach((node) => visit(node as Partial<PenNode> & Record<string, unknown>));
  return [...found];
}

const VERTICAL: Record<NonNullable<TextNode['textAlignVertical']>, string> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
};

function textColorStyle(fill: string | undefined): CSSProperties {
  if (!isLayeredPaint(fill)) return { color: fill || '#ffffff' };
  return { background: fill, backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent' };
}

/** Font, colour, wrapping and alignment of a text node */
export function textStyle(text: TextNode): CSSProperties {
  // pen.dev puts unaligned text at the top of a fixed box; older app files centred it
  const vertical = text.textAlignVertical ?? (text.textGrowth === 'fixed-width-height' ? 'top' : 'middle');
  const decorations = [text.underline && 'underline', text.strikethrough && 'line-through'].filter(Boolean);
  return {
    ...textColorStyle(text.fill),
    fontFamily: fontStack(text.fontFamily),
    fontSize: px(text.fontSize ?? 16),
    fontWeight: text.fontWeight ?? '400',
    fontStyle: text.fontStyle,
    // Files from pen.dev size text boxes by their content, at the font's own line height
    lineHeight: text.lineHeight ?? (text.heightSizing ? 'normal' : 1.4),
    letterSpacing: text.letterSpacing ? px(text.letterSpacing) : undefined,
    textAlign: text.textAlign ?? 'left',
    textDecoration: decorations.length > 0 ? decorations.join(' ') : undefined,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: VERTICAL[vertical],
    whiteSpace: text.widthSizing === 'fit_content' ? 'pre' : 'pre-wrap',
    userSelect: 'none',
  };
}
