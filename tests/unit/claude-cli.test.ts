import { describe, it, expect } from 'vitest';
import { buildCliInvocation, parseCliResult, parseBridgeRequest } from '../../server/claude-cli';
import { buildDesignRequest, extractDesignRoot, DESIGN_TOOL_NAME } from '../../src/generator/design-generator';

const request = buildDesignRequest({
  prompt: 'Landing page cho tiệm bánh',
  attachments: [{ id: '1', type: 'image', name: 'ref.png', previewUrl: 'data:image/png;base64,AAAA' }],
  modelId: 'claude-haiku-5-5',
  variantIndex: 0,
  variantCount: 1,
  mode: 'side-by-side',
});

function resultLine(fields: Record<string, unknown>): string {
  return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, ...fields });
}

describe('buildCliInvocation', () => {
  const { args, stdin } = buildCliInvocation(request);

  it('runs headless with structured output from the design tool schema', () => {
    expect(args).toContain('-p');
    expect(args[args.indexOf('--json-schema') + 1]).toBe(JSON.stringify(request.tools[0].input_schema));
    expect(args[args.indexOf('--model') + 1]).toBe('claude-haiku-5-5');
    expect(args[args.indexOf('--system-prompt') + 1]).toBe(request.system);
    expect(args[args.indexOf('--input-format') + 1]).toBe('stream-json');
  });

  it('disables tools, MCP servers and user customizations', () => {
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(args).toContain('--strict-mcp-config');
    expect(args).toContain('--safe-mode');
    expect(args).toContain('--no-session-persistence');
  });

  it('keeps the subscription login: never uses --bare, which forces API-key auth', () => {
    expect(args).not.toContain('--bare');
  });

  it('sends the prompt and images on stdin as one stream-json user message, never in argv', () => {
    expect(args.join(' ')).not.toContain('tiệm bánh');
    expect(stdin.endsWith('\n')).toBe(true);
    const line = JSON.parse(stdin);
    expect(line.type).toBe('user');
    expect(line.message.role).toBe('user');
    expect(line.message.content).toEqual(request.messages[0].content);
  });
});

describe('parseCliResult', () => {
  const design = { type: 'frame', name: 'Landing', x: 0, y: 0, width: 1280, height: 800, children: [] };

  it('wraps structured output as a create_design tool call', () => {
    const stdout = [
      JSON.stringify({ type: 'system', subtype: 'init' }),
      resultLine({ structured_output: { design } }),
    ].join('\n');
    const message = parseCliResult(stdout, '');
    expect(message.content[0]).toMatchObject({ type: 'tool_use', name: DESIGN_TOOL_NAME, input: { design } });
    expect(extractDesignRoot(message).width).toBe(1280);
  });

  it('reports CLI errors with the CLI text', () => {
    const stdout = resultLine({ is_error: true, result: 'Not logged in · Please run /login' });
    expect(() => parseCliResult(stdout, '')).toThrow(/Not logged in/);
  });

  it('reports a non-success subtype', () => {
    expect(() => parseCliResult(resultLine({ subtype: 'error_max_turns' }), '')).toThrow(/error_max_turns/);
  });

  it('reports a missing structured output', () => {
    expect(() => parseCliResult(resultLine({ result: 'Sorry' }), '')).toThrow(/thiết kế/);
  });

  it('falls back to stderr when there is no result line', () => {
    expect(() => parseCliResult('garbage', 'Error: boom')).toThrow(/boom/);
  });
});

describe('parseBridgeRequest', () => {
  it('accepts a request built by buildDesignRequest', () => {
    expect(parseBridgeRequest(JSON.parse(JSON.stringify(request))).model).toBe('claude-haiku-5-5');
  });

  it('rejects models outside the allowlist', () => {
    expect(() => parseBridgeRequest({ ...request, model: '--dangerously-skip-permissions' })).toThrow(/model/i);
  });

  it('rejects malformed bodies', () => {
    expect(() => parseBridgeRequest({ model: 'claude-haiku-5-5' })).toThrow();
    expect(() => parseBridgeRequest(null)).toThrow();
  });
});
