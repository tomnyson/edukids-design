import { recordRecent, RecentEntry, RecentVisit } from './recent-files';

/**
 * Recents live in IndexedDB because file handles survive there (structured
 * clone) but not in localStorage. The whole list is one record.
 */
const DB_NAME = 'pen-dev';
const STORE = 'recents';
const KEY = 'list';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Không mở được IndexedDB'));
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Lỗi IndexedDB'));
    });
  } finally {
    db.close();
  }
}

const available = () => typeof indexedDB !== 'undefined';

export async function loadRecents(): Promise<RecentEntry[]> {
  if (!available()) return [];
  const list = await run<RecentEntry[] | undefined>('readonly', (store) => store.get(KEY));
  return Array.isArray(list) ? list : [];
}

async function saveRecents(list: RecentEntry[]): Promise<void> {
  await run('readwrite', (store) => store.put(list, KEY));
}

/** Read-modify-write steps run one at a time so an open and a save cannot overwrite each other */
let queue: Promise<unknown> = Promise.resolve();

function update<T>(step: () => Promise<T>): Promise<T> {
  const result = queue.then(step, step);
  queue = result.catch(() => undefined);
  return result;
}

/** Records an open or a save of a file that has a handle; files without one are not remembered */
export function addRecent(visit: RecentVisit): Promise<void> {
  if (!available()) return Promise.resolve();
  return update(async () => saveRecents(await recordRecent(await loadRecents(), visit, Date.now())));
}

export function removeRecent(id: string): Promise<RecentEntry[]> {
  if (!available()) return Promise.resolve([]);
  return update(async () => {
    const list = (await loadRecents()).filter((entry) => entry.id !== id);
    await saveRecents(list);
    return list;
  });
}
