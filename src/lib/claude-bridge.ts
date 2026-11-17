import type { CreateMessage, DesignMessage } from '../generator/design-generator';

/** Routes served by the dev/preview server bridge in server/claude-bridge-plugin.ts */
export const CLAUDE_BRIDGE_ROUTES = {
  status: '/api/claude/status',
  design: '/api/claude/design',
} as const;

export interface BridgeStatus {
  available: boolean;
  version?: string;
  error?: string;
}

type BridgeDesignResponse = { ok: true; message: DesignMessage } | { ok: false; error: string };

/** False on static hosting, where no server bridge exists */
export async function fetchBridgeStatus(): Promise<BridgeStatus> {
  try {
    const res = await fetch(CLAUDE_BRIDGE_ROUTES.status);
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
      return { available: false };
    }
    return (await res.json()) as BridgeStatus;
  } catch {
    return { available: false };
  }
}

/** Runs one design request through the local `claude` CLI via the server bridge */
export const bridgeCreateMessage: CreateMessage = async (request) => {
  const res = await fetch(CLAUDE_BRIDGE_ROUTES.design, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  let body: BridgeDesignResponse;
  try {
    body = (await res.json()) as BridgeDesignResponse;
  } catch {
    throw new Error(`Claude CLI bridge lỗi (HTTP ${res.status}).`);
  }
  if (!body.ok) throw new Error(body.error);
  return body.message;
};
