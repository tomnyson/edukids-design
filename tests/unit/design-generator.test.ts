import { describe, it, expect } from 'vitest';
import {
  resolveModelId,
  buildDesignRequest,
  extractDesignRoot,
  placeDesigns,
  generateDesigns,
  DesignGenerationError,
  DEFAULT_DESIGN_MODEL,
  DESIGN_TOOL_NAME,
  DesignMessage,
  describeGenerationError,
} from '../../src/generator/design-generator';
import { FrameNode, PenNode, TextNode } from '../../src/types/pen-ast';

function toolMessage(input: unknown, stopReason = 'tool_use'): DesignMessage {
  return {
    stop_reason: stopReason,
    content: [{ type: 'tool_use', id: 'toolu_1', name: DESIGN_TOOL_NAME, input }],
  };
}

const VALID_DESIGN = {
  design: {
    id: 'root',
    type: 'frame',
    name: 'Landing',
    x: 0,
    y: 0,
    width: 1280,
    height: 800,
    fill: '#ffffff',
    children: [
      { id: 'title', type: 'text', content: 'Hello', x: 40, y: 40, width: 400, height: 60, fontSize: 48 },
      { id: 'cta', type: 'rect', x: 40, y: 140, width: 160, height: 48, fill: '#000000' },
    ],
  },
};

describe('resolveModelId', () => {
  it('maps current Claude display names to API ids', () => {
    expect(resolveModelId('Claude Opus 5.5')).toEqual({ modelId: 'claude-opus-5-5', substituted: false });
    expect(resolveModelId('Claude Fable 5.1')).toEqual({ modelId: 'claude-fable-5-1', substituted: false });
  });

  it('substitutes legacy and non-Anthropic models with the default', () => {
    expect(resolveModelId('Claude 3 Opus')).toEqual({ modelId: DEFAULT_DESIGN_MODEL, substituted: true });
    expect(resolveModelId('GPT-4o (ChatGPT)')).toEqual({ modelId: DEFAULT_DESIGN_MODEL, substituted: true });
    expect(resolveModelId('pen.dev Pro - MiniMax M3')).toEqual({ modelId: DEFAULT_DESIGN_MODEL, substituted: true });
  });
});

describe('buildDesignRequest', () => {
  it('forces the design tool and includes the prompt', () => {
    const req = buildDesignRequest({
      prompt: 'Landing page for a bakery',
      attachments: [],
      modelId: 'claude-opus-5-5',
      variantIndex: 0,
      variantCount: 1,
      mode: 'side-by-side',
    });
    expect(req.model).toBe('claude-opus-5-5');
    expect(req.tool_choice).toEqual({ type: 'tool', name: DESIGN_TOOL_NAME });
    expect(req.tools[0].name).toBe(DESIGN_TOOL_NAME);
    expect(JSON.stringify(req.messages)).toContain('Landing page for a bakery');
  });

  it('gives each side-by-side variant a different art direction', () => {
    const base = { prompt: 'x', attachments: [], modelId: 'm', variantCount: 3, mode: 'side-by-side' as const };
    const a = JSON.stringify(buildDesignRequest({ ...base, variantIndex: 0 }).messages);
    const b = JSON.stringify(buildDesignRequest({ ...base, variantIndex: 1 }).messages);
    expect(a).not.toEqual(b);
  });

  it('assigns a page section per agent in split mode', () => {
    const req = buildDesignRequest({
      prompt: 'x',
      attachments: [],
      modelId: 'm',
      variantIndex: 1,
      variantCount: 3,
      mode: 'split',
    });
    expect(JSON.stringify(req.messages)).toMatch(/section/i);
  });

  it('sends image attachments as base64 image blocks and text files as text', () => {
    const req = buildDesignRequest({
      prompt: 'x',
      attachments: [
        { id: '1', type: 'image', name: 'ref.png', previewUrl: 'data:image/png;base64,AAAA' },
        { id: '2', type: 'file', name: 'DESIGN.md', content: '# Brand: teal' },
        { id: '3', type: 'style', name: 'Style: Minimal' },
      ],
      modelId: 'm',
      variantIndex: 0,
      variantCount: 1,
      mode: 'side-by-side',
    });
    const content = req.messages[0].content as Array<Record<string, unknown>>;
    expect(content).toContainEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'AAAA' },
    });
    const text = JSON.stringify(content);
    expect(text).toContain('# Brand: teal');
    expect(text).toContain('Style: Minimal');
  });
});

describe('extractDesignRoot', () => {
  it('returns a validated frame with fresh, unique ids', () => {
    const root = extractDesignRoot(toolMessage(VALID_DESIGN));
    expect(root.type).toBe('frame');
    expect(root.width).toBe(1280);
    const ids = [root.id, ...root.children.map((c: PenNode) => c.id)];
    expect(ids).not.toContain('root');
    expect(ids).not.toContain('title');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reports truncated output clearly', () => {
    expect(() => extractDesignRoot(toolMessage(VALID_DESIGN, 'max_tokens'))).toThrow(/quá dài|max_tokens/);
  });

  it('rejects a response without the design tool call', () => {
    const msg: DesignMessage = { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Sorry' }] };
    expect(() => extractDesignRoot(msg)).toThrow(DesignGenerationError);
  });

  it('rejects a root that is not a sized frame', () => {
    const bad = { design: { id: 'r', type: 'text', content: 'hi' } };
    expect(() => extractDesignRoot(toolMessage(bad))).toThrow(DesignGenerationError);
  });

  it('turns a rect with nested children into a frame so captions still render', () => {
    const input = {
      design: {
        id: 'r',
        type: 'frame',
        width: 600,
        height: 400,
        children: [
          {
            id: 'img',
            type: 'rect',
            x: 0,
            y: 0,
            width: 300,
            height: 200,
            children: [{ id: 'cap', type: 'text', content: 'Caption', x: 10, y: 170, width: 200, height: 20 }],
          },
        ],
      },
    };
    const image = extractDesignRoot(toolMessage(input)).children[0] as FrameNode;
    expect(image.type).toBe('frame');
    expect(image.children).toHaveLength(1);
    expect((image.children[0] as TextNode).content).toBe('Caption');
  });

  it('drops node types the canvas cannot render and sizes unsized text', () => {
    const input = {
      design: {
        id: 'r',
        type: 'frame',
        width: 600,
        height: 400,
        children: [
          { id: 'c', type: 'component', componentId: 'x' },
          { id: 't', type: 'text', content: 'Body', x: 20, y: 10, fontSize: 20 },
        ],
      },
    };
    const root = extractDesignRoot(toolMessage(input));
    expect(root.children).toHaveLength(1);
    const text = root.children[0] as TextNode;
    expect(text.width).toBe(580);
    expect(text.height).toBe(28);
  });
});

describe('placeDesigns', () => {
  const frame = (width: number, height: number): FrameNode => ({
    id: `f${width}`,
    type: 'frame',
    width,
    height,
    children: [],
  });

  it('starts at the default origin on an empty canvas', () => {
    const [placed] = placeDesigns([frame(100, 50)], [], 'row');
    expect(placed.x).toBe(80);
    expect(placed.y).toBe(80);
  });

  it('places designs to the right of existing content without moving it', () => {
    const existing: PenNode[] = [{ id: 'e', type: 'rect', x: 100, y: 200, width: 300, height: 10 }];
    const placed = placeDesigns([frame(100, 50), frame(200, 50)], existing, 'row');
    expect(placed[0].x).toBe(480);
    expect(placed[0].y).toBe(200);
    expect(placed[1].x).toBe(480 + 100 + 80);
  });

  it('stacks split sections vertically', () => {
    const placed = placeDesigns([frame(100, 50), frame(100, 70)], [], 'column');
    expect(placed[1].x).toBe(placed[0].x);
    expect(placed[1].y).toBe(80 + 50);
  });
});

describe('generateDesigns', () => {
  it('runs one request per agent and keeps successes when some fail', async () => {
    let call = 0;
    const result = await generateDesigns({
      prompt: 'x',
      attachments: [],
      modelId: 'm',
      count: 3,
      mode: 'side-by-side',
      createMessage: async () => {
        call++;
        if (call === 2) throw new Error('rate limited');
        return toolMessage(VALID_DESIGN);
      },
    });
    expect(call).toBe(3);
    expect(result.designs).toHaveLength(2);
    expect(result.errors).toEqual(['rate limited']);
  });

  it('keeps split sections in page order even when they finish out of order', async () => {
    const result = await generateDesigns({
      prompt: 'x',
      attachments: [],
      modelId: 'm',
      count: 2,
      mode: 'split',
      createMessage: async (req) => {
        const isFirst = JSON.stringify(req.messages).includes('section 1 of 2');
        await new Promise((r) => setTimeout(r, isFirst ? 20 : 0));
        return toolMessage({ design: { ...VALID_DESIGN.design, name: isFirst ? 'first' : 'second' } });
      },
    });
    expect(result.designs.map((d) => d.name)).toEqual(['first', 'second']);
  });
});

describe('describeGenerationError', () => {
  it('turns API status codes into actionable messages', () => {
    expect(describeGenerationError({ status: 401 })).toMatch(/API key/);
    expect(describeGenerationError({ status: 429 })).toMatch(/429/);
    expect(describeGenerationError({ status: 529 })).toMatch(/529/);
    expect(describeGenerationError(new Error('boom'))).toBe('boom');
  });
});
