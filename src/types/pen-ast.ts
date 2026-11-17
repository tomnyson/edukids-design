export type NodeType = 'frame' | 'text' | 'rect' | 'ellipse' | 'path' | 'image' | 'component' | 'browser' | 'icon';

export type LayoutMode = 'none' | 'flex' | 'grid';
export type FlexDirection = 'row' | 'column';
export type TextGrowth = 'auto' | 'fixed-width' | 'fixed-width-height';
export type TextAlign = 'left' | 'center' | 'right' | 'justify';
/** pen.dev dynamic sizes: take the parent's size, or wrap the children */
export type Sizing = 'fill_container' | 'fit_content';
export type CornerRadii = [number, number, number, number];

export interface StrokeSides {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/** A pen.dev effect, kept in the file's own shape */
export interface PenEffect {
  type: 'blur' | 'background_blur' | 'shadow' | 'shader' | string;
  enabled?: boolean;
  radius?: number;
  shadowType?: 'inner' | 'outer';
  offset?: { x: number; y: number };
  blur?: number;
  spread?: number;
  color?: string;
}

export interface BaseNode {
  id: string;
  type: NodeType;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** When set, the size follows the layout; width/height are only the fallback */
  widthSizing?: Sizing;
  heightSizing?: Sizing;
  /** Taken out of the parent's flex flow and placed at x/y */
  layoutPosition?: 'auto' | 'absolute';
  rotation?: number;
  /** Mirrored left-right / top-bottom around the node's centre */
  flipX?: boolean;
  flipY?: boolean;
  /** A CSS colour, or a CSS background (gradients, images, layers) for richer pen.dev fills */
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Per-side stroke widths; strokeWidth is unset when these are used */
  strokeWidths?: StrokeSides;
  strokeLinecap?: 'round' | 'square' | 'butt';
  strokeLinejoin?: 'round' | 'miter' | 'bevel';
  cornerRadius?: number;
  /** Top-left, top-right, bottom-right, bottom-left; cornerRadius is unset when these are used */
  cornerRadii?: CornerRadii;
  effects?: PenEffect[];
  opacity?: number;
  visible?: boolean;
}

export interface FrameNode extends BaseNode {
  type: 'frame';
  /** Marks the frame as a component master that instances render */
  reusable?: boolean;
  clip?: boolean;
  layout?: LayoutMode;
  flexDirection?: FlexDirection;
  gap?: number;
  padding?: number | [number, number] | [number, number, number, number];
  justifyContent?: 'start' | 'center' | 'end' | 'between' | 'around';
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  children: PenNode[];
}

export interface TextNode extends BaseNode {
  type: 'text';
  content: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  lineHeight?: number;
  textAlign?: TextAlign;
  letterSpacing?: number;
  textGrowth?: TextGrowth;
  textAlignVertical?: 'top' | 'middle' | 'bottom';
  fontStyle?: string;
  underline?: boolean;
  strikethrough?: boolean;
}

export interface PathNode extends BaseNode {
  type: 'path';
  geometry: string;
}

export interface RectNode extends BaseNode {
  type: 'rect';
}

export interface EllipseNode extends BaseNode {
  type: 'ellipse';
}

export type ImageFit = 'cover' | 'contain' | 'fill';

export interface ImageNode extends BaseNode {
  type: 'image';
  /** http(s) URL, or a data:image/... URL for uploaded files */
  src: string;
  fit?: ImageFit;
  alt?: string;
}

/** Changes to one node inside an instance: a patch, or a whole new node when it has a `type` */
export type DescendantOverride = Partial<PenNode> & Record<string, unknown>;

export interface ComponentNode extends BaseNode {
  type: 'component';
  componentId: string;
  /** Keyed by the descendant's id, or an id path through nested instances ("inner/label") */
  descendants?: Record<string, DescendantOverride>;
  children?: PenNode[];
}

export interface IconNode extends BaseNode {
  type: 'icon';
  /** pen.dev icon library, e.g. "lucide" */
  library?: string;
  icon?: string;
  weight?: number;
}

export type PenNode = FrameNode | TextNode | PathNode | RectNode | EllipseNode | ImageNode | ComponentNode | IconNode;

/** A node exactly as a pen.dev file stores it, with an empty children list in place of its children */
export type PenSourceNode = Record<string, unknown> & { id: string; type: string };

export interface TokenValue {
  value: string | number;
  theme?: {
    Mode?: string;
    [key: string]: any;
  };
}

export interface DesignVariable {
  type: 'color' | 'font' | 'dimension' | 'string' | 'number' | string;
  value: string | number | TokenValue[];
}

export interface PenDocument {
  version: string;
  children: PenNode[];
  themes?: Record<string, string[]>;
  variables?: Record<string, DesignVariable>;
  imports?: Record<string, string>;
  fileToken?: string;
  /**
   * The nodes as the opened pen.dev file wrote them, by id. Saving writes a
   * field's original form back while its value is unchanged, so an opened
   * file round-trips exactly.
   */
  penSource?: Record<string, PenSourceNode>;
}
