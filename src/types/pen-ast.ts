export type NodeType = 'frame' | 'text' | 'rect' | 'ellipse' | 'path' | 'component' | 'browser';

export type LayoutMode = 'none' | 'flex' | 'grid';
export type FlexDirection = 'row' | 'column';
export type TextGrowth = 'auto' | 'fixed-width' | 'fixed-width-height';
export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface BaseNode {
  id: string;
  type: NodeType;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: 'round' | 'square' | 'butt';
  strokeLinejoin?: 'round' | 'miter' | 'bevel';
  cornerRadius?: number;
  opacity?: number;
  visible?: boolean;
}

export interface FrameNode extends BaseNode {
  type: 'frame';
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

export interface ComponentNode extends BaseNode {
  type: 'component';
  componentId: string;
  overrides?: Record<string, any>;
  children?: PenNode[];
}

export type PenNode = FrameNode | TextNode | PathNode | RectNode | EllipseNode | ComponentNode;

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
}
