import { FrameNode, PenNode, TextNode } from '../types/pen-ast';
import { PenNodeSchema } from '../core/schema/pen-validator';
import { generateNodeId } from '../core/io/pen-file-handler';
import type { ContextAttachment } from '../store/useDesignStore';
import { DESIGN_SYSTEM_PROMPT, VARIANT_DIRECTIONS } from './design-prompt';
import { PagePlan, fallbackPlan, planPage } from './page-plan';
import { UserContent, buildUserContent } from './request-content';

export const DESIGN_TOOL_NAME = 'create_design';
export const DEFAULT_DESIGN_MODEL = 'claude-opus-5-5';
const MAX_OUTPUT_TOKENS = 16000;
const CANVAS_ORIGIN = 80;
/** Space between designs placed next to each other, and beside existing content */
export const DESIGN_GAP = 80;

export type GenerationMode = 'split' | 'side-by-side';

/** Model picker labels that map to a model able to run this tool call */
const MODEL_IDS: Record<string, string> = {
  'Claude Opus 5.5': 'claude-opus-5-5',
  'Claude Fable 5.1': 'claude-fable-5-1',
  'Claude Sonnet 5.5': 'claude-sonnet-5-5',
  'Claude Haiku 5.5': 'claude-haiku-5-5',
};

/** Model ids a generation request may name; the CLI bridge rejects anything else */
export const SUPPORTED_MODEL_IDS: readonly string[] = Object.values(MODEL_IDS);

/** Subset of the Messages API request this module builds */
export interface DesignRequest {
  model: string;
  max_tokens: number;
  system: string;
  tools: { name: string; description: string; input_schema: { type: 'object'; [key: string]: unknown } }[];
  tool_choice: { type: 'tool'; name: string };
  messages: { role: 'user'; content: UserContent }[];
}

/** Subset of the Messages API response this module reads */
export interface DesignMessage {
  stop_reason: string | null;
  content: Array<{ type: string; name?: string; input?: unknown; text?: string; id?: string }>;
}

export type CreateMessage = (request: DesignRequest) => Promise<DesignMessage>;

export class DesignGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignGenerationError';
  }
}

export function resolveModelId(displayName: string): { modelId: string; substituted: boolean } {
  const modelId = MODEL_IDS[displayName];
  return modelId ? { modelId, substituted: false } : { modelId: DEFAULT_DESIGN_MODEL, substituted: true };
}

const DESIGN_TOOL = {
  name: DESIGN_TOOL_NAME,
  description: 'Place the finished UI design on the canvas as a tree of absolutely positioned nodes.',
  input_schema: {
    type: 'object' as const,
    properties: {
      design: {
        type: 'object',
        description: 'Root frame node: { type: "frame", name, x: 0, y: 0, width, height, fill, children: [...] }',
        properties: {
          type: { type: 'string', enum: ['frame'] },
          name: { type: 'string' },
          width: { type: 'number' },
          height: { type: 'number' },
          fill: { type: 'string' },
          children: { type: 'array', items: { type: 'object' } },
        },
        required: ['type', 'name', 'width', 'height', 'children'],
      },
    },
    required: ['design'],
  },
};

export interface DesignRequestOptions {
  prompt: string;
  attachments: ContextAttachment[];
  modelId: string;
  variantIndex: number;
  variantCount: number;
  mode: GenerationMode;
  /** Shared plan for split work; the fallback plan is used when absent */
  plan?: PagePlan;
}

/** Short name of a side-by-side variant's art direction ("Editorial", "Bento") */
export function variantLabel(variantIndex: number): string {
  return VARIANT_DIRECTIONS[variantIndex % VARIANT_DIRECTIONS.length].split(':')[0];
}

function splitBrief(index: number, count: number, plan: PagePlan): string {
  const section = plan.sections[index];
  const { palette, fonts } = plan;
  const outline = plan.sections.map((s, i) => `${i + 1}. ${s.name}`).join('; ');
  return [
    `You are agent ${index + 1} of ${count} building one page together.`,
    `Design only section ${index + 1} of ${count}: "${section.name}"${section.brief ? ` (${section.brief})` : ''}.`,
    `Full page outline, top to bottom: ${outline}. The other agents build the other sections; do not repeat them.`,
    `The root frame is exactly ${plan.width} wide and about ${section.estimatedHeight} tall.`,
    `Use exactly this shared palette: background ${palette.background}, surface ${palette.surface}, text ${palette.text}, muted text ${palette.mutedText}, accent ${palette.accent}.`,
    `Fonts: headings "${fonts.heading}", body "${fonts.body}".`,
    `Shared visual style: ${plan.styleNotes}`,
    'Use the full page width. The sections are stacked vertically with no gap, so do not add outer margins above or below.',
  ].join(' ');
}

function briefFor({ variantIndex, variantCount, mode, plan }: DesignRequestOptions): string {
  if (mode === 'split' && variantCount > 1) {
    const usable = plan && plan.sections.length === variantCount ? plan : fallbackPlan(variantCount);
    return splitBrief(variantIndex, variantCount, usable);
  }
  if (variantCount > 1) {
    return `Art direction for this variant: ${VARIANT_DIRECTIONS[variantIndex % VARIANT_DIRECTIONS.length]}`;
  }
  return '';
}

export function buildDesignRequest(options: DesignRequestOptions): DesignRequest {
  const parts = [`Design request: ${options.prompt}`, briefFor(options)];
  return {
    model: options.modelId,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: DESIGN_SYSTEM_PROMPT,
    tools: [DESIGN_TOOL],
    tool_choice: { type: 'tool', name: DESIGN_TOOL_NAME },
    messages: [{ role: 'user', content: buildUserContent(options.attachments, parts) }],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Replaces model-chosen ids with fresh unique ones so pasted designs never collide */
function withFreshIds(raw: unknown, used: Set<string>): unknown {
  if (!isRecord(raw)) return raw;
  let id = generateNodeId();
  while (used.has(id)) id = generateNodeId();
  used.add(id);
  const children = Array.isArray(raw.children) ? raw.children.map((c) => withFreshIds(c, used)) : raw.children;
  return { ...raw, id, children };
}

const RENDERABLE_TYPES = new Set(['frame', 'text', 'rect']);
const DEFAULT_FONT_SIZE = 16;
const TEXT_LINE_HEIGHT = 1.4;

/**
 * Drops node types the canvas cannot draw, gives unsized text a usable box and
 * turns rects with children into frames (the renderer never draws rect children).
 */
function normalizeNode(node: PenNode, parentWidth: number): PenNode | null {
  if (!RENDERABLE_TYPES.has(node.type)) return null;
  const nested = (node as { children?: PenNode[] }).children;
  if (node.type === 'rect' && nested && nested.length > 0) {
    return normalizeNode({ ...node, type: 'frame', children: nested } as FrameNode, parentWidth);
  }
  if (node.type === 'text') {
    const text = node as TextNode;
    return {
      ...text,
      width: text.width || Math.max(1, parentWidth - (text.x ?? 0)),
      height: text.height || Math.round((text.fontSize ?? DEFAULT_FONT_SIZE) * TEXT_LINE_HEIGHT),
    };
  }
  if (node.type === 'frame') {
    const frame = node as FrameNode;
    const width = frame.width ?? 0;
    const children = (frame.children ?? [])
      .map((child) => normalizeNode(child, width))
      .filter((child): child is PenNode => child !== null);
    return { ...frame, children };
  }
  return node;
}

/** Pulls the design out of a create_design tool call and validates it */
export function extractDesignRoot(message: DesignMessage): FrameNode {
  if (message.stop_reason === 'max_tokens') {
    throw new DesignGenerationError('Thiết kế quá dài, model bị cắt ở max_tokens. Hãy thu hẹp yêu cầu.');
  }
  const call = message.content.find((block) => block.type === 'tool_use' && block.name === DESIGN_TOOL_NAME);
  if (!call || !isRecord(call.input)) {
    throw new DesignGenerationError('Model không trả về thiết kế (thiếu lệnh create_design).');
  }

  const parsed = PenNodeSchema.safeParse(withFreshIds(call.input.design, new Set()));
  if (!parsed.success) {
    throw new DesignGenerationError(`Thiết kế không hợp lệ: ${parsed.error.issues[0]?.message ?? 'sai cấu trúc'}`);
  }
  const root = parsed.data as PenNode;
  if (root.type !== 'frame' || !root.width || !root.height) {
    throw new DesignGenerationError('Thiết kế không hợp lệ: gốc phải là frame có width và height.');
  }
  return normalizeNode(root, root.width) as FrameNode;
}

/** Where new designs start: right of everything on the canvas, or the default origin when it is empty */
export function designOrigin(existing: PenNode[]): { x: number; y: number } {
  if (existing.length === 0) return { x: CANVAS_ORIGIN, y: CANVAS_ORIGIN };
  return {
    x: Math.max(...existing.map((n) => (n.x ?? 0) + (n.width ?? 0))) + DESIGN_GAP,
    y: Math.min(...existing.map((n) => n.y ?? 0)),
  };
}

/**
 * Positions new designs next to (row) or below each other (column), to the right
 * of anything already on the canvas so existing work is never covered.
 */
export function placeDesigns(
  designs: FrameNode[],
  existing: PenNode[],
  direction: 'row' | 'column'
): FrameNode[] {
  const { x: startX, y: startY } = designOrigin(existing);

  let offset = 0;
  return designs.map((design) => {
    const placed =
      direction === 'row' ? { ...design, x: startX + offset, y: startY } : { ...design, x: startX, y: startY + offset };
    offset += direction === 'row' ? (design.width ?? 0) + DESIGN_GAP : design.height ?? 0;
    return placed;
  });
}

/** Turns SDK/network errors into a short message for the toast */
export function describeGenerationError(err: unknown): string {
  const status = isRecord(err) && typeof err.status === 'number' ? err.status : null;
  if (status === 401) return 'API key Anthropic không hợp lệ.';
  if (status === 404) return 'Model không tồn tại hoặc tài khoản chưa có quyền dùng.';
  if (status === 429) return 'Bị giới hạn tốc độ (429). Thử lại sau ít phút.';
  if (status !== null && status >= 500) return `Máy chủ Anthropic lỗi (${status}). Thử lại sau.`;
  return err instanceof Error ? err.message : 'Lỗi không xác định';
}

/** What happens during a run, in order: an optional planning step, then each agent on its own */
export type GenerationEvent =
  | { type: 'plan-started' }
  | { type: 'plan-ready'; plan: PagePlan; usedFallback: boolean }
  | { type: 'agent-started'; index: number }
  | { type: 'agent-done'; index: number; frame: FrameNode }
  | { type: 'agent-failed'; index: number; error: string };

export interface GenerateDesignsOptions {
  prompt: string;
  attachments: ContextAttachment[];
  modelId: string;
  count: number;
  mode: GenerationMode;
  createMessage: CreateMessage;
  onProgress?: (event: GenerationEvent) => void;
  planTimeoutMs?: number;
}

export interface GenerateDesignsResult {
  /** Finished designs in agent order */
  designs: FrameNode[];
  errors: string[];
}

/**
 * Runs one agent per variant/section in parallel; partial failures still return
 * the rest. Split work with several agents plans the page first so the sections
 * share one outline, palette and font pairing.
 */
export async function generateDesigns(options: GenerateDesignsOptions): Promise<GenerateDesignsResult> {
  const { count, mode, createMessage } = options;
  const emit = (event: GenerationEvent) => {
    try {
      options.onProgress?.(event);
    } catch {
      // A broken listener must not cost the user a finished design
    }
  };

  let plan: PagePlan | undefined;
  if (mode === 'split' && count > 1) {
    emit({ type: 'plan-started' });
    const planned = await planPage({
      prompt: options.prompt,
      attachments: options.attachments,
      modelId: options.modelId,
      count,
      createMessage,
      timeoutMs: options.planTimeoutMs,
    });
    plan = planned.plan;
    emit({ type: 'plan-ready', plan, usedFallback: planned.usedFallback });
  }

  const runAgent = async (index: number): Promise<FrameNode> => {
    emit({ type: 'agent-started', index });
    try {
      const request = buildDesignRequest({ ...options, variantIndex: index, variantCount: count, plan });
      const frame = extractDesignRoot(await createMessage(request));
      emit({ type: 'agent-done', index, frame });
      return frame;
    } catch (error) {
      emit({ type: 'agent-failed', index, error: describeGenerationError(error) });
      throw error;
    }
  };
  const settled = await Promise.allSettled(Array.from({ length: count }, (_, index) => runAgent(index)));

  return {
    designs: settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])),
    errors: settled.flatMap((r) => (r.status === 'rejected' ? [describeGenerationError(r.reason)] : [])),
  };
}
