import { loadState, STORAGE_KEY, type PersistedState } from './appState';

let database: IDBDatabase;

export async function restoreWorkspace() {
  database = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open('databloom-workspace', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('snapshots');
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  const saved = await new Promise<PersistedState | undefined>((resolve, reject) => {
    const read = database.transaction('snapshots').objectStore('snapshots').get('current');
    read.onsuccess = () => resolve(read.result);
    read.onerror = () => reject(read.error);
  });
  return loadState(saved);
}

export async function saveWorkspace(state: PersistedState) {
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('snapshots', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.objectStore('snapshots').put(state, 'current');
  });
  // Release the old snapshot only after IndexedDB has committed its replacement.
  localStorage.removeItem(STORAGE_KEY);
}
