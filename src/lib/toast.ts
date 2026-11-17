import { useDesignStore } from '../store/useDesignStore';

const DEFAULT_TOAST_MS = 2500;

/** Shows a toast and clears it later unless another message replaced it */
export function notify(message: string, durationMs: number = DEFAULT_TOAST_MS): void {
  const { setToastMessage } = useDesignStore.getState();
  setToastMessage(message);
  setTimeout(() => {
    if (useDesignStore.getState().toastMessage === message) setToastMessage(null);
  }, durationMs);
}
