import type { Track } from "../types";

/**
 * Сервис обложек.
 * 1. Встроенная обложка из тегов (Electron: volna://cover/<hash>)
 * 2. iTunes Search API, затем Deezer — по исполнителю и названию
 * Кэш в localStorage, одинаковые запросы объединяются.
 * Пустые ответы запоминаются в рамках сессии (seenQueries) — после
 * перезапуска попытка повторяется.
 */

const CACHE_KEY = "volna-art-v1";
const cache = new Map<string, string>();
const sharedKey = (t: Track) => `${t.artist.toLowerCase()}|${t.title.toLowerCase()}`;

let cacheLoaded = false;
function loadCache() {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, string>;
    for (const [k, v] of Object.entries(obj)) if (v) cache.set(k, v);
  } catch {
    /* нет кэша */
  }
}
function persistCache() {
  try {
    const entries = [...cache.entries()].slice(-800);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* переполнение — игнорируем */
  }
}

/** объединяет одинаковые запросы, висящие одновременно */
const pending = new Map<string, Array<(u: string | null) => void>>();
/** навсегда запомненные «пустые» запросы (не тратим сеть повторно) */
const seenQueries = new Set<string>();

export function getArt(track: Track): Promise<string | null> {
  loadCache();
  const hit = cache.get(track.id) ?? (track.artist ? cache.get(sharedKey(track)) : undefined);
  if (hit) return Promise.resolve(hit);
  const q = `${track.artist} ${track.title}`.trim();
  if (!q) return Promise.resolve(null);
  const qk = q.toLowerCase();
  if (seenQueries.has(qk)) return Promise.resolve(null);

  const existing = pending.get(qk);
  if (existing) {
    return new Promise((res) => existing.push(res));
  }

  const callbacks: Array<(u: string | null) => void> = [];
  pending.set(qk, callbacks);
  return new Promise((res) => {
    callbacks.push(res);
    fetchArt(track).then((u) => {
      pending.delete(qk);
      if (u) {
        cache.set(track.id, u);
        if (track.artist) cache.set(sharedKey(track), u);
        persistCache();
      } else {
        seenQueries.add(qk);
      }
      callbacks.forEach((cb) => cb(u));
    });
  });
}

async function fetchArt(track: Track): Promise<string | null> {
  const q = encodeURIComponent(`${track.artist} ${track.title}`.trim());
  if (!q) return null;
  try {
    const r = await fetch(`https://itunes.apple.com/search?term=${q}&media=music&entity=song&limit=8`);
    if (r.ok) {
      const j = (await r.json()) as { results?: Array<{ artworkUrl100?: string }> };
      const art = j.results?.find((x) => x.artworkUrl100)?.artworkUrl100;
      if (art) return art.replace(/\d+x\d+bb/g, "600x600bb");
    }
  } catch {
    /* iTunes недоступен */
  }
  try {
    const r = await fetch(`https://api.deezer.com/search?q=${q}&limit=8`);
    if (r.ok) {
      const j = (await r.json()) as { data?: Array<{ album?: { cover_medium?: string } }> };
      const c = j.data?.[0]?.album?.cover_medium;
      if (c) return c;
    }
  } catch {
    /* Deezer недоступен */
  }
  return null;
}
