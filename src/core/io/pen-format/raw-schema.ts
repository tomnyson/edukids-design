import { z } from 'zod';

/**
 * The shape every .pen file must have. Lenient on purpose: pen.dev adds node
 * types and fields over time, and unknown ones are kept, not rejected.
 */

/** A boolean, or a "$name" variable holding one */
const flag = z.union([z.boolean(), z.string().regex(/^\$/)]).optional();

interface RawNode {
  id: string;
  type: string;
  children?: RawNode[];
  [key: string]: unknown;
}

const RawNodeSchema: z.ZodType<RawNode> = z.lazy(() =>
  z
    .object({
      id: z.string(),
      type: z.string(),
      flipX: flag,
      flipY: flag,
      children: z.array(RawNodeSchema).optional(),
    })
    .passthrough()
);

const RawDocumentSchema = z
  .object({
    version: z.string().optional(),
    children: z.array(RawNodeSchema).optional(),
    variables: z.record(z.object({ type: z.string(), value: z.unknown() }).passthrough()).optional(),
  })
  .passthrough();

export type RawPenDocument = z.infer<typeof RawDocumentSchema>;

/**
 * `input` itself once it is known to be a .pen file (zod's copy would reorder
 * keys), or an error naming the first bad field
 */
export function parseRawPenDocument(input: unknown): RawPenDocument {
  const result = RawDocumentSchema.safeParse(input);
  if (result.success) return input as RawPenDocument;
  const issue = result.error.issues[0];
  const where = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
  throw new Error(`Invalid .pen file: ${where}${issue.message}`);
}
