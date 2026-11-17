import { z } from 'zod';
import {
  DESIGN_TOOL_NAME,
  SUPPORTED_MODEL_IDS,
  DesignMessage,
  DesignRequest,
} from '../src/generator/design-generator';

/**
 * Translates a DesignRequest into a headless `claude -p` run. The CLI uses the
 * user's Claude Code login, so no API key is needed. Kept free of Node APIs so
 * it can be unit tested.
 */

const ContentBlockSchema = z.union([
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({
    type: z.literal('image'),
    source: z.object({
      type: z.literal('base64'),
      media_type: z.enum(['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
      data: z.string(),
    }),
  }),
]);

const BridgeRequestSchema = z.object({
  model: z.string().refine((model) => SUPPORTED_MODEL_IDS.includes(model), { message: 'Model không được hỗ trợ' }),
  max_tokens: z.number(),
  system: z.string(),
  tools: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        input_schema: z.object({ type: z.literal('object') }).passthrough(),
      })
    )
    .length(1),
  tool_choice: z.object({ type: z.literal('tool'), name: z.string() }),
  messages: z
    .array(z.object({ role: z.literal('user'), content: z.array(ContentBlockSchema).min(1) }))
    .length(1),
});

/** Validates an untrusted request body; throws with the first problem found */
export function parseBridgeRequest(body: unknown): DesignRequest {
  const parsed = BridgeRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Yêu cầu không hợp lệ: ${issue?.path.join('.') || 'body'} ${issue?.message ?? ''}`.trim());
  }
  return parsed.data as DesignRequest;
}

export interface CliInvocation {
  args: string[];
  stdin: string;
}

export function buildCliInvocation(request: DesignRequest): CliInvocation {
  const args = [
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--json-schema', JSON.stringify(request.tools[0].input_schema),
    '--model', request.model,
    '--system-prompt', request.system,
    // Pure generation: no tools, MCP servers, hooks, plugins or CLAUDE.md
    '--tools', '',
    '--strict-mcp-config',
    '--safe-mode',
    '--no-session-persistence',
  ];
  // The prompt can carry 50k chars of attachments and base64 images, so it goes on stdin
  const stdin = `${JSON.stringify({ type: 'user', message: request.messages[0] })}\n`;
  return { args, stdin };
}

const STDERR_TAIL_CHARS = 500;

function findResultLine(stdout: string): Record<string, unknown> | null {
  const lines = stdout.split('\n').reverse();
  for (const line of lines) {
    if (!line.trim().startsWith('{')) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed === 'object' && parsed !== null && (parsed as { type?: unknown }).type === 'result') {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Partial or non-JSON line: keep looking
    }
  }
  return null;
}

/** Reads the final result event of a stream-json run and shapes it like a call of the requested tool */
export function parseCliResult(stdout: string, stderr: string, toolName: string = DESIGN_TOOL_NAME): DesignMessage {
  const result = findResultLine(stdout);
  if (!result) {
    const detail = stderr.trim().slice(-STDERR_TAIL_CHARS) || 'không có kết quả';
    throw new Error(`Claude CLI lỗi: ${detail}`);
  }
  if (result.is_error === true || result.subtype !== 'success') {
    const detail = typeof result.result === 'string' && result.result ? result.result : String(result.subtype);
    throw new Error(`Claude CLI lỗi: ${detail}`);
  }
  const output = result.structured_output;
  if (typeof output !== 'object' || output === null) {
    throw new Error('Claude CLI không trả về thiết kế.');
  }
  return {
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', name: toolName, input: output }],
  };
}
