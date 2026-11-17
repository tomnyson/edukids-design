import { create } from 'zustand';
import { GenerationRun, SlotPatch, patchSlot } from '../lib/generation-run';

export interface GenerationStore {
  /** The generation in flight; only one runs at a time */
  run: GenerationRun | null;
  startRun: (run: GenerationRun) => void;
  /** Updates a slot of the current run; ignored when `runId` is no longer current */
  patchSlot: (runId: string, slotId: string, patch: SlotPatch) => void;
  /** Replaces every slot of the current run through `update` */
  updateRun: (runId: string, update: (run: GenerationRun) => GenerationRun) => void;
  clearRun: (runId: string) => void;
}

/** In-memory only: a reload drops the run, and the document never contained it */
export const useGenerationStore = create<GenerationStore>((set, get) => ({
  run: null,

  startRun: (run) => set({ run }),

  patchSlot: (runId, slotId, patch) => {
    const { run } = get();
    if (run?.id === runId) set({ run: patchSlot(run, slotId, patch) });
  },

  updateRun: (runId, update) => {
    const { run } = get();
    if (run?.id === runId) set({ run: update(run) });
  },

  clearRun: (runId) => {
    if (get().run?.id === runId) set({ run: null });
  },
}));
