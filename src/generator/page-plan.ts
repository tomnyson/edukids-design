import { z } from 'zod';
import type { ContextAttachment } from '../store/useDesignStore';
import type { CreateMessage, DesignMessage, DesignRequest } from './design-generator';
import { VARIANT_DIRECTIONS, sectionFor } from './design-prompt';
import { buildUserContent } from './request-content';

export const PLAN_TOOL_NAME = 'plan_page';
/** A planner slower than this counts as failed; the agents start from the fallback plan */
export const PLAN_TIMEOUT_MS = 60_000;
const PLAN_MAX_TOKENS = 2000;

const MIN_WIDTH = 320;
const MAX_WIDTH = 1920;
const MIN_SECTION_HEIGHT = 200;
const MAX_SECTION_HEIGHT = 3000;
const FALLBACK_WIDTH = 1280;
const FALLBACK_SECTION_HEIGHT = 800;

export interface PlanPalette {
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  accent: string;
}

export interface PlanSection {
  name: string;
  brief: string;
  estimatedHeight: number;
}

/** What every split-work agent shares: page size, colours, fonts and who builds which section */
export interface PagePlan {
  width: number;
  palette: PlanPalette;
  fonts: { heading: string; body: string };
  styleNotes: string;
  sections: PlanSection[];
}

const clamp = (min: number, max: number) => (value: number) => Math.round(Math.max(min, Math.min(max, value)));
const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
const shortText = z.string().trim().min(1).max(200);

const PagePlanSchema = z.object({
  width: z.number().finite().transform(clamp(MIN_WIDTH, MAX_WIDTH)),
  palette: z.object({
    background: hexColor,
    surface: hexColor,
    text: hexColor,
    mutedText: hexColor,
    accent: hexColor,
  }),
  fonts: z.object({ heading: shortText, body: shortText }),
  styleNotes: z.string().max(1000),
  sections: z.array(
    z.object({
      name: shortText,
      brief: z.string().max(1000),
      estimatedHeight: z.number().finite().transform(clamp(MIN_SECTION_HEIGHT, MAX_SECTION_HEIGHT)),
    })
  ),
});

const HEX_PROPERTY = { type: 'string', description: 'Hex colour such as #0f172a' };

const PLAN_TOOL = {
  name: PLAN_TOOL_NAME,
  description: 'Record the shared plan that every section designer will follow.',
  input_schema: {
    type: 'object' as const,
    properties: {
      width: { type: 'number', description: 'Page width in px: 1280 for desktop web, 390 for mobile' },
      palette: {
        type: 'object',
        properties: {
          background: HEX_PROPERTY,
          surface: HEX_PROPERTY,
          text: HEX_PROPERTY,
          mutedText: HEX_PROPERTY,
          accent: HEX_PROPERTY,
        },
        required: ['background', 'surface', 'text', 'mutedText', 'accent'],
      },
      fonts: {
        type: 'object',
        properties: { heading: { type: 'string' }, body: { type: 'string' } },
        required: ['heading', 'body'],
      },
      styleNotes: { type: 'string', description: 'One or two sentences on the visual style' },
      sections: {
        type: 'array',
        description: 'Page sections from top to bottom, one per designer',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            brief: { type: 'string', description: 'What this section contains' },
            estimatedHeight: { type: 'number', description: 'Expected height in px' },
          },
          required: ['name', 'brief', 'estimatedHeight'],
        },
      },
    },
    required: ['width', 'palette', 'fonts', 'styleNotes', 'sections'],
  },
};

const PLAN_SYSTEM_PROMPT = `You are the lead designer planning one UI page that several designers will build in parallel, one section each. They cannot talk to each other, so your plan is the only thing that keeps the page consistent.

Rules:
- Derive the sections from the request itself: a dashboard gets dashboard regions, a landing page gets marketing sections, a mobile screen gets its screen regions.
- List the sections from top to bottom. They are stacked vertically with no gap and together form the complete page.
- Choose one palette and one font pairing for the whole page that fit the request and any attached reference.
- Write section names and briefs in the language of the request.`;

export interface PlanRequestOptions {
  prompt: string;
  attachments: ContextAttachment[];
  modelId: string;
  /** Number of agents, and so the number of sections */
  count: number;
}

export function buildPlanRequest(options: PlanRequestOptions): DesignRequest {
  const parts = [
    `Design request: ${options.prompt}`,
    `Plan the page as exactly ${options.count} sections, one per designer.`,
  ];
  return {
    model: options.modelId,
    max_tokens: PLAN_MAX_TOKENS,
    system: PLAN_SYSTEM_PROMPT,
    tools: [PLAN_TOOL],
    tool_choice: { type: 'tool', name: PLAN_TOOL_NAME },
    messages: [{ role: 'user', content: buildUserContent(options.attachments, parts) }],
  };
}

/** Reads and validates the plan_page tool call; throws when it is unusable */
export function extractPagePlan(message: DesignMessage, count: number): PagePlan {
  if (message.stop_reason === 'max_tokens') throw new Error('Plan was cut off at max_tokens.');
  const call = message.content.find((block) => block.type === 'tool_use' && block.name === PLAN_TOOL_NAME);
  if (!call) throw new Error('Planner returned no plan.');
  const plan = PagePlanSchema.parse(call.input);
  if (plan.sections.length !== count) {
    throw new Error(`Planner returned ${plan.sections.length} sections, expected ${count}.`);
  }
  return plan;
}

/** The hardcoded section list and style used before planning existed */
export function fallbackPlan(count: number): PagePlan {
  return {
    width: FALLBACK_WIDTH,
    palette: { background: '#f7f3ec', surface: '#ffffff', text: '#1a1a1a', mutedText: '#6b6660', accent: '#c2553a' },
    fonts: { heading: 'Georgia', body: 'Inter' },
    styleNotes: VARIANT_DIRECTIONS[0],
    sections: Array.from({ length: count }, (_, index) => ({
      name: sectionFor(index, count),
      brief: '',
      estimatedHeight: FALLBACK_SECTION_HEIGHT,
    })),
  };
}

export interface PlanPageOptions extends PlanRequestOptions {
  createMessage: CreateMessage;
  timeoutMs?: number;
}

export interface PlanPageResult {
  plan: PagePlan;
  usedFallback: boolean;
}

/**
 * Asks the model for a page plan. Never rejects: an error, an invalid plan or
 * a planner slower than the deadline all yield the fallback plan, so planning
 * cannot block generation. A late planner reply is ignored.
 */
export async function planPage(options: PlanPageOptions): Promise<PlanPageResult> {
  const { createMessage, timeoutMs = PLAN_TIMEOUT_MS, ...requestOptions } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Planner timed out.')), timeoutMs);
  });
  try {
    const message = await Promise.race([createMessage(buildPlanRequest(requestOptions)), deadline]);
    return { plan: extractPagePlan(message, options.count), usedFallback: false };
  } catch {
    // Any planner failure is recoverable: the caller reports that the fallback was used
    return { plan: fallbackPlan(options.count), usedFallback: true };
  } finally {
    clearTimeout(timer);
  }
}
