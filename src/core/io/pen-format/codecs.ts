import { fillToCss, strokeToCss } from './paint';

/**
 * Field-by-field mapping between pen.dev nodes and the app's nodes. Each codec
 * owns some pen.dev keys and some app keys; reading turns the first into the
 * second, writing the reverse. Keys no codec owns are copied as they are.
 */

export type Json = Record<string, unknown>;

export interface ReadContext {
  /** File written by this app before pen.dev compatibility: no pen.dev defaults */
  legacy: boolean;
  /** An override patch inside `descendants`: only the keys present, no defaults */
  partial: boolean;
  readDescendant: (raw: Json) => Json;
}

export interface WriteContext {
  writeDescendant: (node: Json) => Json;
  /** The descendant's raw override when unchanged, so its original form is kept */
  keepDescendant: (raw: unknown, node: Json) => boolean;
}

export interface Codec {
  pen: readonly string[];
  app: readonly string[];
  read: (raw: Json, ctx: ReadContext) => Json;
  write: (node: Json, ctx: WriteContext, source?: Json) => Json;
}

const isObject = (value: unknown): value is Json => !!value && typeof value === 'object' && !Array.isArray(value);

const swap = (map: Record<string, string>) => Object.fromEntries(Object.entries(map).map(([a, b]) => [b, a]));

const TYPE_IN: Record<string, string> = { rectangle: 'rect', ref: 'component', group: 'frame' };
const TYPE_OUT: Record<string, string> = { rect: 'rectangle', component: 'ref', image: 'rectangle' };
/** Node types the app draws itself; anything else is drawn as a box */
const APP_TYPES = new Set(['frame', 'text', 'rect', 'ellipse', 'path', 'image', 'component', 'browser', 'icon']);

const JUSTIFY_IN: Record<string, string> = { space_between: 'between', space_around: 'around' };
const JUSTIFY_OUT = swap(JUSTIFY_IN);

const IMAGE_MODE_IN: Record<string, string> = { stretch: 'fill' };
const IMAGE_MODE_OUT = swap(IMAGE_MODE_IN);

/** The image fill of a rectangle that is only an image: one image paint */
function soleImageFill(fill: unknown): Json | undefined {
  const only = Array.isArray(fill) ? (fill.length === 1 ? fill[0] : undefined) : fill;
  return isObject(only) && only.type === 'image' && typeof only.url === 'string' && only.enabled !== false
    ? only
    : undefined;
}

const SIZING = /^(fill_container|fit_content)(?:\((-?\d+(?:\.\d+)?)\))?$/;

/** pen.dev only sizes text by width/height for these growth modes */
const growsWide = (raw: Json) => raw.textGrowth === undefined || raw.textGrowth === 'auto';
const growsTall = (raw: Json) => growsWide(raw) || raw.textGrowth === 'fixed-width';

function sizeCodec(axis: 'width' | 'height'): Codec {
  const sizingKey = axis === 'width' ? 'widthSizing' : 'heightSizing';
  const grows = axis === 'width' ? growsWide : growsTall;
  return {
    pen: [axis],
    app: [axis, sizingKey],
    read: (raw, ctx) => {
      const value = raw[axis];
      const out: Json = {};
      if (typeof value === 'number') out[axis] = value;
      const match = typeof value === 'string' ? SIZING.exec(value) : null;
      if (match) {
        out[sizingKey] = match[1];
        if (match[2] !== undefined) out[axis] = Number(match[2]);
      }
      if (ctx.legacy || ctx.partial || match) return out;
      if (raw.type === 'frame' && value === undefined) out[sizingKey] = 'fit_content';
      if (raw.type === 'text' && grows(raw)) out[sizingKey] = 'fit_content';
      return out;
    },
    write: (node) => {
      const size = node[axis];
      const sizing = node[sizingKey];
      if (typeof sizing === 'string') return { [axis]: typeof size === 'number' ? `${sizing}(${size})` : sizing };
      return size === undefined ? {} : { [axis]: size };
    },
  };
}

const typeCodec: Codec = {
  pen: ['type'],
  app: ['type'],
  read: (raw) => {
    if (raw.type === undefined) return {};
    const type = String(raw.type);
    if (type === 'rectangle' && soleImageFill(raw.fill)) return { type: 'image' };
    const mapped = TYPE_IN[type] ?? type;
    return { type: APP_TYPES.has(mapped) ? mapped : 'rect' };
  },
  write: (node) => ({ type: TYPE_OUT[String(node.type)] ?? node.type }),
};

const fillCodec: Codec = {
  pen: ['fill'],
  app: ['fill', 'src', 'fit'],
  read: (raw) => {
    const image = raw.type === 'rectangle' ? soleImageFill(raw.fill) : undefined;
    if (image) {
      const mode = String(image.mode ?? 'cover');
      return { src: image.url, fit: IMAGE_MODE_IN[mode] ?? mode };
    }
    if (raw.fill === undefined) return {};
    // Legacy files already store a CSS paint
    return { fill: typeof raw.fill === 'string' ? raw.fill : fillToCss(raw.fill) };
  },
  write: (node) => {
    if (node.type === 'image') {
      const fit = String(node.fit ?? 'cover');
      return { fill: { type: 'image', url: node.src, mode: IMAGE_MODE_OUT[fit] ?? fit } };
    }
    return node.fill === undefined ? {} : { fill: node.fill };
  },
};

const strokeCodec: Codec = {
  pen: ['stroke'],
  app: ['stroke'],
  read: (raw) => (raw.stroke === undefined ? {} : { stroke: strokeToCss(raw.stroke) }),
  write: (node) => (node.stroke === undefined ? {} : { stroke: node.stroke }),
};

const strokeWidthCodec: Codec = {
  pen: ['strokeWidth'],
  app: ['strokeWidth', 'strokeWidths'],
  read: (raw) => {
    if (typeof raw.strokeWidth === 'number') return { strokeWidth: raw.strokeWidth };
    return isObject(raw.strokeWidth) ? { strokeWidths: raw.strokeWidth } : {};
  },
  write: (node) => {
    if (node.strokeWidths !== undefined) return { strokeWidth: node.strokeWidths };
    return node.strokeWidth === undefined ? {} : { strokeWidth: node.strokeWidth };
  },
};

const cornerRadiusCodec: Codec = {
  pen: ['cornerRadius'],
  app: ['cornerRadius', 'cornerRadii'],
  read: (raw) => {
    if (typeof raw.cornerRadius === 'number') return { cornerRadius: raw.cornerRadius };
    return Array.isArray(raw.cornerRadius) && raw.cornerRadius.length === 4 ? { cornerRadii: raw.cornerRadius } : {};
  },
  write: (node) => {
    if (node.cornerRadii !== undefined) return { cornerRadius: node.cornerRadii };
    return node.cornerRadius === undefined ? {} : { cornerRadius: node.cornerRadius };
  },
};

const effectCodec: Codec = {
  pen: ['effect'],
  app: ['effects'],
  read: (raw) => {
    if (raw.effect === undefined) return {};
    return { effects: (Array.isArray(raw.effect) ? raw.effect : [raw.effect]).filter(isObject) };
  },
  write: (node) => {
    const effects = Array.isArray(node.effects) ? node.effects : [];
    if (effects.length === 0) return {};
    return { effect: effects.length === 1 ? effects[0] : effects };
  },
};

const enabledCodec: Codec = {
  pen: ['enabled'],
  app: ['visible'],
  read: (raw) => (typeof raw.enabled === 'boolean' ? { visible: raw.enabled } : {}),
  write: (node) => (typeof node.visible === 'boolean' ? { enabled: node.visible } : {}),
};

const refCodec: Codec = {
  pen: ['ref'],
  app: ['componentId'],
  read: (raw) => (typeof raw.ref === 'string' ? { componentId: raw.ref } : {}),
  write: (node) => (typeof node.componentId === 'string' ? { ref: node.componentId } : {}),
};

const layoutCodec: Codec = {
  pen: ['layout'],
  app: ['layout', 'flexDirection'],
  read: (raw, ctx) => {
    switch (raw.layout) {
      case 'vertical':
        return { layout: 'flex', flexDirection: 'column' };
      case 'horizontal':
        return { layout: 'flex', flexDirection: 'row' };
      case undefined:
        return raw.type === 'frame' && !ctx.legacy && !ctx.partial ? { layout: 'flex', flexDirection: 'row' } : {};
      case 'none':
        // An unset layout already means none to the app, and saving writes it back
        return ctx.legacy ? {} : { layout: 'none' };
      default:
        // The legacy flex/grid, whose direction is a key of its own
        return typeof raw.flexDirection === 'string'
          ? { layout: raw.layout, flexDirection: raw.flexDirection }
          : { layout: raw.layout };
    }
  },
  write: (node) => {
    if (node.layout === 'flex') return { layout: node.flexDirection === 'column' ? 'vertical' : 'horizontal' };
    if (node.layout === 'grid') return { layout: 'horizontal' };
    return node.type === 'frame' ? { layout: 'none' } : {};
  },
};

const justifyCodec: Codec = {
  pen: ['justifyContent'],
  app: ['justifyContent'],
  read: (raw) =>
    raw.justifyContent === undefined
      ? {}
      : { justifyContent: JUSTIFY_IN[String(raw.justifyContent)] ?? raw.justifyContent },
  write: (node) =>
    node.justifyContent === undefined
      ? {}
      : { justifyContent: JUSTIFY_OUT[String(node.justifyContent)] ?? node.justifyContent },
};

const alignCodec: Codec = {
  pen: ['alignItems'],
  app: ['alignItems'],
  read: (raw) => (raw.alignItems === undefined ? {} : { alignItems: raw.alignItems }),
  // pen.dev has no stretch; children fill the cross axis with fill_container instead
  write: (node) => (node.alignItems === undefined || node.alignItems === 'stretch' ? {} : { alignItems: node.alignItems }),
};

const textGrowthCodec: Codec = {
  pen: ['textGrowth'],
  app: ['textGrowth'],
  read: (raw) => (raw.textGrowth === undefined ? {} : { textGrowth: raw.textGrowth }),
  write: (node) => {
    if (node.textGrowth !== undefined) return { textGrowth: node.textGrowth };
    // pen.dev ignores a text's size unless its box is fixed
    const sized = typeof node.width === 'number' && node.widthSizing === undefined;
    return node.type === 'text' && sized ? { textGrowth: 'fixed-width-height' } : {};
  },
};

const descendantsCodec: Codec = {
  pen: ['descendants'],
  app: ['descendants'],
  read: (raw, ctx) => {
    if (!isObject(raw.descendants)) return {};
    const entries = Object.entries(raw.descendants).filter(([, patch]) => isObject(patch));
    return { descendants: Object.fromEntries(entries.map(([key, patch]) => [key, ctx.readDescendant(patch as Json)])) };
  },
  write: (node, ctx, source) => {
    if (!isObject(node.descendants)) return {};
    const before = isObject(source?.descendants) ? source.descendants : {};
    const entries = Object.entries(node.descendants).map(([key, patch]) => [
      key,
      ctx.keepDescendant(before[key], patch as Json) ? before[key] : ctx.writeDescendant(patch as Json),
    ]);
    return { descendants: Object.fromEntries(entries) };
  },
};

export const CODECS: readonly Codec[] = [
  typeCodec,
  layoutCodec,
  justifyCodec,
  alignCodec,
  sizeCodec('width'),
  sizeCodec('height'),
  fillCodec,
  strokeCodec,
  strokeWidthCodec,
  cornerRadiusCodec,
  effectCodec,
  enabledCodec,
  refCodec,
  textGrowthCodec,
  descendantsCodec,
];

export const PEN_KEYS = new Set(CODECS.flatMap((codec) => codec.pen));
export const APP_KEYS = new Set(CODECS.flatMap((codec) => codec.app));
