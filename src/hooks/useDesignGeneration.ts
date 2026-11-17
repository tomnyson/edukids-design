import { useCallback, useState } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import { useDesignStore } from '../store/useDesignStore';
import { notify } from '../lib/toast';
import { bridgeCreateMessage, fetchBridgeStatus } from '../lib/claude-bridge';
import {
  CreateMessage,
  GenerationEvent,
  designOrigin,
  generateDesigns,
  resolveModelId,
  variantLabel,
} from '../generator/design-generator';
import type { GenerationResult, ProgressReporter } from '../lib/agent-turn';
import { useGenerationStore } from '../store/useGenerationStore';
import { GenerationRun, agentProgressOf, committedFrames, createRun } from '../lib/generation-run';

const ANTHROPIC_KEY_STORAGE = 'ant_api_key';
// Stays up until the result toast replaces it; large designs can take minutes
const PROGRESS_TOAST_MS = 15 * 60_000;
const RESULT_TOAST_MS = 6000;
/** Placeholder size before a plan or a finished frame says otherwise */
const DEFAULT_SLOT = { width: 1280, height: 800 };
const PLANNING_LABEL = 'chờ kế hoạch';
const SINGLE_LABEL = 'Thiết kế';
const PLANNING_TEXT = '🧭 Đang lập kế hoạch trang…';

function readApiKey(): string {
  try {
    return localStorage.getItem(ANTHROPIC_KEY_STORAGE)?.trim() ?? '';
  } catch {
    return '';
  }
}

function anthropicCreateMessage(apiKey: string): CreateMessage {
  // The app has no backend yet, so the user's own key is used straight from the browser
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  return (request) => client.messages.create(request);
}

interface Backend {
  label: string;
  createMessage: CreateMessage;
}

/** Prefers the local `claude` CLI (Claude Code login, no key); the API key is the fallback */
async function resolveBackend(): Promise<Backend | null> {
  const status = await fetchBridgeStatus();
  if (status.available) return { label: 'Claude CLI', createMessage: bridgeCreateMessage };
  const apiKey = readApiKey();
  return apiKey ? { label: 'API key', createMessage: anthropicCreateMessage(apiKey) } : null;
}

/** Applies one generation event to the run on the canvas */
function applyEvent(runId: string, event: GenerationEvent): void {
  const store = useGenerationStore.getState();
  const slotId = (index: number) => store.run?.slots[index]?.id ?? '';
  switch (event.type) {
    case 'plan-started':
      return;
    case 'plan-ready':
      store.updateRun(runId, (run) => ({
        ...run,
        slots: run.slots.map((slot) => {
          const section = event.plan.sections[slot.index];
          return section
            ? { ...slot, label: section.name, width: event.plan.width, height: section.estimatedHeight }
            : slot;
        }),
      }));
      return;
    case 'agent-started':
      store.patchSlot(runId, slotId(event.index), { status: 'running', startedAt: Date.now() });
      return;
    case 'agent-done':
      store.patchSlot(runId, slotId(event.index), {
        status: 'done',
        frame: event.frame,
        width: event.frame.width ?? DEFAULT_SLOT.width,
        height: event.frame.height ?? DEFAULT_SLOT.height,
        finishedAt: Date.now(),
      });
      return;
    case 'agent-failed':
      store.patchSlot(runId, slotId(event.index), { status: 'error', error: event.error, finishedAt: Date.now() });
  }
}

function progressText(event: GenerationEvent, run: GenerationRun): string {
  if (event.type === 'plan-started') return PLANNING_TEXT;
  const settled = run.slots.filter((slot) => slot.status === 'done' || slot.status === 'error').length;
  return `🎨 Đang sinh thiết kế… ${settled}/${run.slots.length} agent xong`;
}

export interface DesignGeneration {
  isGenerating: boolean;
  /** `ok` when at least one design was added to the canvas; `message` describes the outcome */
  generate: (prompt: string, modelLabel: string, onProgress?: ProgressReporter) => Promise<GenerationResult>;
}

/**
 * Text-to-design: sends the chat prompt (plus context attachments) to Claude,
 * through the local CLI when available or the browser SDK otherwise. Each
 * agent's frame shows on the canvas as soon as it is ready; when all agents
 * have finished, the frames join the tab that was active at send time as one
 * undo step.
 */
export function useDesignGeneration(onMissingApiKey: () => void): DesignGeneration {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(
    async (prompt: string, modelLabel: string, onProgress?: ProgressReporter): Promise<GenerationResult> => {
      // Shown as a toast and returned as the agent's chat reply
      const finish = (ok: boolean, message: string, run?: GenerationRun | null): GenerationResult => {
        notify(message, RESULT_TOAST_MS);
        return { ok, message, ...(run ? { agents: agentProgressOf(run) } : {}) };
      };
      // Captured before the async status check so a tab switch cannot redirect the result
      const { activeTabId, parallelAgentsCount, parallelMode, contextAttachments, document: targetDoc } =
        useDesignStore.getState();
      const count = Math.max(1, Math.min(6, parallelAgentsCount));
      const isSplit = parallelMode === 'split' && count > 1;
      const { modelId, substituted } = resolveModelId(modelLabel);
      const modelNote = substituted ? ` (${modelLabel} chưa hỗ trợ, dùng ${modelId})` : '';
      const runId = crypto.randomUUID();
      const currentRun = () => {
        const { run } = useGenerationStore.getState();
        return run?.id === runId ? run : null;
      };

      setIsGenerating(true);
      try {
        const backend = await resolveBackend();
        if (!backend) {
          onMissingApiKey();
          return finish(
            false,
            '🔑 Không tìm thấy Claude CLI. Chạy app bằng `npm run dev` với Claude Code đã đăng nhập, hoặc nhập Anthropic API key.'
          );
        }
        notify(`🎨 Đang sinh ${count} thiết kế bằng ${modelId} qua ${backend.label}${modelNote}…`, PROGRESS_TOAST_MS);

        const slotLabel = (index: number) => (isSplit ? PLANNING_LABEL : count > 1 ? variantLabel(index) : SINGLE_LABEL);
        useGenerationStore.getState().startRun(
          createRun({
            id: runId,
            tabId: activeTabId,
            direction: isSplit ? 'column' : 'row',
            origin: designOrigin(targetDoc.children),
            slots: Array.from({ length: count }, (_, index) => ({ label: slotLabel(index), ...DEFAULT_SLOT })),
          })
        );

        let usedFallbackPlan = false;
        const { errors } = await generateDesigns({
          prompt,
          attachments: contextAttachments,
          modelId,
          count,
          mode: parallelMode,
          createMessage: backend.createMessage,
          onProgress: (event) => {
            if (event.type === 'plan-ready') usedFallbackPlan = event.usedFallback;
            applyEvent(runId, event);
            const run = currentRun();
            if (run) onProgress?.({ text: progressText(event, run), agents: agentProgressOf(run) });
          },
        });

        const run = currentRun();
        const frames = run ? committedFrames(run) : [];
        if (frames.length === 0) {
          return finish(false, `❌ Không sinh được thiết kế: ${errors[0] ?? 'không có kết quả'}`, run);
        }
        if (!useDesignStore.getState().appendPlacedFrames(activeTabId, frames)) {
          return finish(false, '⚠️ Tab yêu cầu thiết kế đã bị đóng, kết quả bị bỏ.', run);
        }
        const failed = errors.length > 0 ? ` ${errors.length} agent lỗi: ${errors[0]}` : '';
        const planNote = usedFallbackPlan ? ' Lập kế hoạch trang lỗi, đã dùng bố cục mặc định.' : '';
        return finish(true, `✨ Đã thêm ${frames.length}/${count} thiết kế (⌘Z để hoàn tác).${failed}${planNote}`, run);
      } catch (error) {
        // Replaces the progress toast, which would otherwise stay up for minutes
        return finish(
          false,
          `❌ Lỗi khi sinh thiết kế: ${error instanceof Error ? error.message : 'không rõ nguyên nhân'}`,
          currentRun()
        );
      } finally {
        // The run only ever lived beside the document; whatever was not committed is dropped
        useGenerationStore.getState().clearRun(runId);
        setIsGenerating(false);
      }
    },
    [onMissingApiKey]
  );

  return { isGenerating, generate };
}
