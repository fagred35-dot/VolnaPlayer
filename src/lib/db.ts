import type { StoredTrack } from "../types";

const DB_NAME = "volna-player";
const DB_VER = 1;
const TRACKS = "tracks";
const META = "meta";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(TRACKS)) db.createObjectStore(TRACKS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export async function saveTracks(list: StoredTrack[]): Promise<void> {
  for (const t of list) await tx(TRACKS, "readwrite", (s) => s.put(t));
}

export async function getAllStored(): Promise<StoredTrack[]> {
  return tx(TRACKS, "readonly", (s) => s.getAll());
}

export async function deleteStored(id: string): Promise<void> {
  await tx(TRACKS, "readwrite", (s) => s.delete(id));
}

export async function getStoredBlob(id: string): Promise<Blob | undefined> {
  const rec = await tx<StoredTrack | undefined>(TRACKS, "readonly", (s) => s.get(id));
  return rec?.blob;
}

export async function saveMeta(key: string, value: unknown): Promise<void> {
  await tx(META, "readwrite", (s) => s.put(value, key));
}

export async function loadMeta<T>(key: string): Promise<T | undefined> {
  return tx<T | undefined>(META, "readonly", (s) => s.get(key));
}
