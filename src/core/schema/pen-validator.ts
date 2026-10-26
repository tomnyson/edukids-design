import { z } from 'zod';

export const BaseNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['frame', 'text', 'rect', 'ellipse', 'path', 'component', 'browser']),
  name: z.string().optional(),
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().default(0),
  height: z.number().default(0),
  rotation: z.number().optional(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  strokeLinecap: z.enum(['round', 'square', 'butt']).optional(),
  strokeLinejoin: z.enum(['round', 'miter', 'bevel']).optional(),
  cornerRadius: z.number().optional(),
  opacity: z.number().optional(),
  visible: z.boolean().optional(),
});

// Recursive schema for PenNode
export const PenNodeSchema: z.ZodType<any> = BaseNodeSchema.extend({
  // Frame properties
  clip: z.boolean().optional(),
  layout: z.enum(['none', 'flex', 'grid']).optional(),
  flexDirection: z.enum(['row', 'column']).optional(),
  gap: z.number().optional(),
  padding: z.union([z.number(), z.array(z.number())]).optional(),
  justifyContent: z.enum(['start', 'center', 'end', 'between', 'around']).optional(),
  alignItems: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  children: z.lazy(() => z.array(PenNodeSchema)).optional(),

  // Text properties
  content: z.string().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  lineHeight: z.number().optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  letterSpacing: z.number().optional(),
  textGrowth: z.enum(['auto', 'fixed-width', 'fixed-width-height']).optional(),

  // Path properties
  geometry: z.string().optional(),

  // Component properties
  componentId: z.string().optional(),
  overrides: z.record(z.any()).optional(),
}).passthrough();

export const TokenValueSchema = z.object({
  value: z.union([z.string(), z.number()]),
  theme: z.record(z.any()).optional(),
});

export const DesignVariableSchema = z.object({
  type: z.string(),
  value: z.union([z.string(), z.number(), z.array(TokenValueSchema)]),
});

export const PenDocumentSchema = z.object({
  version: z.string().default('2.13'),
  children: z.array(PenNodeSchema).default([]),
  themes: z.record(z.array(z.string())).optional(),
  variables: z.record(DesignVariableSchema).optional(),
}).passthrough();

export function parsePenDocument(input: unknown) {
  return PenDocumentSchema.parse(input);
}

export function safeParsePenDocument(input: unknown) {
  return PenDocumentSchema.safeParse(input);
}
