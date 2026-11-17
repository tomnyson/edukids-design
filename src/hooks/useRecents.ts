import { useCallback, useEffect, useState } from 'react';
import { loadRecents, removeRecent } from '../core/io/recent-store';
import { RecentEntry } from '../core/io/recent-files';

export interface Recents {
  entries: RecentEntry[];
  isLoading: boolean;
  error: string | null;
  remove: (id: string) => Promise<void>;
}

const message = (err: unknown) => (err instanceof Error ? err.message : 'không rõ nguyên nhân');

/** Home's Recents list, read from IndexedDB each time Home mounts */
export function useRecents(): Recents {
  const [entries, setEntries] = useState<RecentEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRecents()
      .then((list) => !cancelled && setEntries(list))
      .catch((err) => !cancelled && setError(`Không đọc được danh sách gần đây: ${message(err)}`))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      setEntries(await removeRecent(id));
    } catch (err) {
      setError(`Không xoá được khỏi danh sách: ${message(err)}`);
    }
  }, []);

  return { entries, isLoading, error, remove };
}
