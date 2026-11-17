import { safeImageSrc } from '../../../lib/image-source';

/**
 * pen.dev fills (colour, gradient, image, or a list of them) as one CSS
 * background value. A single solid colour stays a plain colour so the app's
 * colour fields keep working on it.
 */

type Paint = Record<string, unknown>;

const isObject = (value: unknown): value is Paint => !!value && typeof value === 'object' && !Array.isArray(value);
const num = (value: unknown, fallback: number): number => (typeof value === 'number' ? value : fallback);
const pct = (value: number) => `${+(value * 100).toFixed(2)}%`;

/** `#RGB`/`#RRGGBB` with the alpha scaled by `opacity`; other colours are returned unchanged */
export function withOpacity(color: string, opacity: number): string {
  if (opacity >= 1 || !/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) return color;
  const hex = color.length === 4 ? `#${[...color.slice(1)].map((c) => c + c).join('')}` : color;
  const alpha = hex.length === 9 ? parseInt(hex.slice(7), 16) / 255 : 1;
  const scaled = Math.round(Math.max(0, Math.min(1, alpha * opacity)) * 255);
  return hex.slice(0, 7) + scaled.toString(16).padStart(2, '0');
}

function gradientCss(paint: Paint): string | undefined {
  const opacity = num(paint.opacity, 1);
  const stops = (Array.isArray(paint.colors) ? paint.colors : [])
    .filter(isObject)
    .filter((stop) => typeof stop.color === 'string')
    .map((stop) => `${withOpacity(stop.color as string, opacity)} ${pct(num(stop.position, 0))}`);
  if (stops.length === 0) return undefined;
  const list = stops.join(', ');
  const center = isObject(paint.center) ? paint.center : {};
  const at = `${pct(num(center.x, 0.5))} ${pct(num(center.y, 0.5))}`;
  // pen.dev turns counter-clockwise from "up"; CSS turns clockwise from "up"
  const angle = (((360 - num(paint.rotation, 0)) % 360) + 360) % 360;
  switch (paint.gradientType ?? 'linear') {
    case 'radial': {
      const size = isObject(paint.size) ? paint.size : {};
      return `radial-gradient(${pct(num(size.width, 1) / 2)} ${pct(num(size.height, 1) / 2)} at ${at}, ${list})`;
    }
    case 'angular':
      return `conic-gradient(from ${angle}deg at ${at}, ${list})`;
    default:
      return `linear-gradient(${angle}deg, ${list})`;
  }
}

const IMAGE_SIZE: Record<string, string> = { cover: 'cover', contain: 'contain', stretch: '100% 100%' };

function imageCss(paint: Paint): string | undefined {
  const src = typeof paint.url === 'string' ? safeImageSrc(paint.url) : null;
  if (!src) return undefined;
  const size = IMAGE_SIZE[String(paint.mode ?? 'cover')] ?? 'cover';
  return `url("${src.replace(/"/g, '%22')}") center / ${size} no-repeat`;
}

/** One fill as a CSS colour (solid) or CSS image layer; undefined when it cannot be shown */
function layerCss(fill: unknown): { color?: string; image?: string } {
  if (typeof fill === 'string') return { color: fill };
  if (!isObject(fill) || fill.enabled === false) return {};
  switch (fill.type) {
    case 'color':
      return typeof fill.color === 'string' ? { color: fill.color } : {};
    case 'gradient':
      return { image: gradientCss(fill) };
    case 'image':
      return { image: imageCss(fill) };
    default:
      return {};
  }
}

/** A pen.dev `fill` value as CSS, or undefined when nothing in it can be shown */
export function fillToCss(fill: unknown): string | undefined {
  const layers = (Array.isArray(fill) ? fill : [fill]).map(layerCss).filter((layer) => layer.color || layer.image);
  if (layers.length === 0) return undefined;
  if (layers.length === 1) return layers[0].color ?? layers[0].image;
  // pen.dev paints the list bottom to top; CSS lists the top layer first
  return [...layers]
    .reverse()
    .map((layer) => layer.image ?? `linear-gradient(${layer.color}, ${layer.color})`)
    .join(', ');
}

/** A pen.dev stroke paint as one CSS colour: the first solid colour, or a gradient's first stop */
export function strokeToCss(stroke: unknown): string | undefined {
  for (const paint of Array.isArray(stroke) ? stroke : [stroke]) {
    if (typeof paint === 'string') return paint;
    if (!isObject(paint) || paint.enabled === false) continue;
    if (paint.type === 'color' && typeof paint.color === 'string') return paint.color;
    if (paint.type === 'gradient' && Array.isArray(paint.colors) && isObject(paint.colors[0])) {
      const first = paint.colors[0].color;
      if (typeof first === 'string') return first;
    }
  }
  return undefined;
}

/** True when a fill string needs `background` rather than `background-color` */
export function isLayeredPaint(fill: string | undefined): boolean {
  return !!fill && /gradient\(|url\(/.test(fill);
}
