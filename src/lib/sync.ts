import type { Track, Playlist } from "../types";
import type { TrackStat } from "../hooks/useStats";
import { isMobilePlatform } from "./platform";

/**
 * Синхронизация библиотеки между устройствами в локальной сети.
 *
 * Архитектура: ПК (Electron) поднимает HTTP-сервер на порту 51789.
 * Телефон сканирует свою подсеть, находит ПК, показывает баннер и после
 * подтверждения обменивается снапшотами библиотеки (протокол volna-sync/1).
 *
 * Совместимость версий: всё построено на одном снапшоте без обязательных
 * новых полей. Старые сборки не имеют sync-кода и просто не участвуют;
 * будущие версии обязаны игнорировать неизвестные поля (JSON-контракт).
 */

export const SYNC_PROTO = 1;
export const SYNC_PORT = 51789;
/** Fallback; реальная версия подставляется через setSyncAppVersion() */
export const SYNC_APP_VERSION = "1.1.0";

let protoAppVersion = SYNC_APP_VERSION;

/** Подставить реальную версию сборки (вызывается один раз из App) */
export function setSyncAppVersion(v: string): void {
  if (v) protoAppVersion = v;
}

const LS_DEVICE = "volna.sync.device";
const LS_PEERS = "volna.sync.peers";
const LS_KNOWN = "volna.sync.known";

export type DeviceType = "pc" | "mobile" | "web";

export interface SyncDevice {
  id: string;
  name: string;
  type: DeviceType;
}

export interface SyncTrack {
  key: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  fav: boolean;
  addedAt: number;
  fileName: string;
  fileSize: number;
}

export interface SyncPlaylist {
  name: string;
  createdAt: number;
  keys: string[];
}

export interface SyncStat {
  count: number;
  lastPlayed: number;
  listened: number;
}

export interface SyncSnapshot {
  proto: number;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  appVersion: string;
  rev: string;
  sentAt: number;
  tracks: SyncTrack[];
  playlists: SyncPlaylist[];
  stats: Record<string, SyncStat>;
}

export interface PeerInfo {
  deviceId: string;
  name: string;
  type: DeviceType;
  ip: string;
  port: number;
  rev: string;
  lastSeen: number;
  /** Парный код устройства (12 hex) — запрашивается у пользователя при подключении.
   *  Требуется для чтения/записи снапшота; /volna/info открыт без кода. */
  token?: string;
}

/* ---------------- идентичность устройства ---------------- */

export function deviceType(): DeviceType {
  if (isMobilePlatform()) return "mobile";
  if (typeof window !== "undefined" && window.volna) return "pc";
  return "web";
}

function defaultDeviceName(type: DeviceType): string {
  if (type === "pc") {
    try {
      // В Electron вернётся имя компьютера через syncStatus, здесь — заглушка
      return "Компьютер";
    } catch {
      return "Компьютер";
    }
  }
  if (type === "mobile") return "Телефон";
  return "Браузер";
}

export function loadDevice(): SyncDevice {
  try {
    const raw = localStorage.getItem(LS_DEVICE);
    if (raw) {
      const d = JSON.parse(raw) as SyncDevice;
      if (d && d.id && d.name && d.type) return d;
    }
  } catch {
    /* пересоздаём */
  }
  const type = deviceType();
  const d: SyncDevice = {
    id: "d_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    name: defaultDeviceName(type),
    type,
  };
  try {
    localStorage.setItem(LS_DEVICE, JSON.stringify(d));
  } catch {
    /* приватный режим */
  }
  return d;
}

export function saveDeviceName(name: string): SyncDevice {
  const d = loadDevice();
  d.name = name.trim() || d.name;
  try {
    localStorage.setItem(LS_DEVICE, JSON.stringify(d));
  } catch {
    /* ignore */
  }
  return d;
}

/* ---------------- подключённые устройства ---------------- */

export function loadPeers(): PeerInfo[] {
  try {
    const raw = localStorage.getItem(LS_PEERS);
    if (raw) return JSON.parse(raw) as PeerInfo[];
  } catch {
    /* ignore */
  }
  return [];
}

export function savePeers(peers: PeerInfo[]): void {
  try {
    localStorage.setItem(LS_PEERS, JSON.stringify(peers));
  } catch {
    /* ignore */
  }
}

function knownSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_KNOWN) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

function addKnown(id: string): void {
  try {
    const s = knownSet();
    s.add(id);
    localStorage.setItem(LS_KNOWN, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

/* ---------------- стабильный ключ трека ----------------
   Один и тот же файл на ПК и телефоне даёт один ключ:
   имя файла без пути + размер (или округлённая длительность). */

export function trackKey(t: Track): string {
  const base = t.fileName.split(/[\\/]/).pop() || t.fileName;
  const sizeOrDur = t.fileSize || Math.round(t.duration);
  return `${base.toLowerCase()}|${sizeOrDur}`;
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16) + "_" + s.length.toString(16);
}

/** Ревизия библиотеки — одинакова на всех устройствах при одинаковом содержимом */
export function computeRev(input: {
  tracks: SyncTrack[];
  playlists: SyncPlaylist[];
  stats: Record<string, SyncStat>;
}): string {
  const tracks = [...input.tracks].sort((a, b) => (a.key < b.key ? -1 : 1));
  const pls = [...input.playlists].sort((a, b) => (a.name < b.name ? -1 : 1));
  const statKeys = Object.keys(input.stats).sort();
  let s = "";
  for (const t of tracks) s += `${t.key}\u0001${t.fav ? 1 : 0}\u0002`;
  for (const p of pls) s += `${p.name.toLowerCase()}\u0001${p.keys.join(",")}\u0002`;
  for (const k of statKeys) {
    const st = input.stats[k];
    s += `${k}\u0001${st.count}\u0001${st.listened}\u0002`;
  }
  return djb2(s);
}

/* ---------------- снапшоты ---------------- */

export function buildSnapshot(
  device: SyncDevice,
  tracks: Track[],
  playlists: Playlist[],
  stats: Record<string, TrackStat>
): SyncSnapshot {
  const idToKey = new Map(tracks.map((t) => [t.id, trackKey(t)]));
  const syncTracks: SyncTrack[] = tracks.map((t) => ({
    key: trackKey(t),
    title: t.title,
    artist: t.artist,
    album: t.album,
    duration: t.duration,
    fav: !!t.fav,
    addedAt: t.addedAt,
    fileName: (t.fileName.split(/[\\/]/).pop() || t.fileName).toLowerCase(),
    fileSize: t.fileSize || 0,
  }));
  const keyOfStat = new Map<string, SyncStat>();
  for (const [id, st] of Object.entries(stats)) {
    const key = idToKey.get(id);
    if (key) keyOfStat.set(key, { count: st.count, lastPlayed: st.lastPlayed, listened: st.listened });
  }
  const syncPls: SyncPlaylist[] = playlists.map((p) => ({
    name: p.name,
    createdAt: p.createdAt,
    keys: p.trackIds.map((id) => idToKey.get(id)).filter((k): k is string => !!k),
  }));
  const snap: SyncSnapshot = {
    proto: SYNC_PROTO,
    deviceId: device.id,
    deviceName: device.name,
    deviceType: device.type,
    appVersion: protoAppVersion,
    rev: "",
    sentAt: Date.now(),
    tracks: syncTracks,
    playlists: syncPls,
    stats: Object.fromEntries(keyOfStat),
  };
  snap.rev = computeRev(snap);
  return snap;
}

export interface MergeResult {
  favPatches: Array<{ id: string; fav: boolean }>;
  statsPatches: Record<string, TrackStat>;
  playlists: Playlist[] | null;
  matched: number;
}

/**
 * Слияние входящего снапшота с локальными данными.
 * Правила: fav = OR, статистика = max, плейлисты — по имени;
 * треки, которых нет локально, не добавляются (файлы не передаются).
 */
export function mergeIncoming(
  tracks: Track[],
  playlists: Playlist[],
  stats: Record<string, TrackStat>,
  incoming: SyncSnapshot
): MergeResult {
  const localByKey = new Map(tracks.map((t) => [trackKey(t), t]));
  const favPatches: Array<{ id: string; fav: boolean }> = [];
  let matched = 0;

  for (const st of incoming.tracks) {
    const local = localByKey.get(st.key);
    if (!local) continue;
    matched++;
    if (st.fav && !local.fav) favPatches.push({ id: local.id, fav: true });
  }

  // статистика: ключ -> id
  const statsPatches: Record<string, TrackStat> = {};
  for (const [key, inc] of Object.entries(incoming.stats || {})) {
    const local = localByKey.get(key);
    if (!local) continue;
    const cur = stats[local.id];
    const next: TrackStat = {
      count: Math.max(cur?.count ?? 0, inc.count ?? 0),
      lastPlayed: Math.max(cur?.lastPlayed ?? 0, inc.lastPlayed ?? 0),
      listened: Math.max(cur?.listened ?? 0, inc.listened ?? 0),
    };
    if (cur && cur.count === next.count && cur.listened === next.listened && cur.lastPlayed === next.lastPlayed) continue;
    statsPatches[local.id] = next;
  }

  // плейлисты: слияние по имени (без учёта регистра), ключи → локальные id
  const incomingPls = Array.isArray(incoming.playlists) ? incoming.playlists : [];
  let plsChanged = false;
  const result = playlists.map((p) => ({ ...p }));
  for (const inc of incomingPls) {
    if (!inc || !Array.isArray(inc.keys)) continue;
    let pl = result.find((x) => x.name.toLowerCase() === String(inc.name).toLowerCase());
    if (!pl) {
      pl = { id: uidSafe(), name: String(inc.name), trackIds: [], createdAt: inc.createdAt || Date.now(), pendingKeys: [] };
      result.push(pl);
      plsChanged = true;
    }
    const have = new Set(pl.trackIds);
    const pending = new Set(pl.pendingKeys ?? []);
    for (const key of inc.keys) {
      const local = localByKey.get(key);
      if (local) {
        if (!have.has(local.id)) {
          pl.trackIds.push(local.id);
          have.add(local.id);
          plsChanged = true;
        }
        pending.delete(key);
      } else if (!pending.has(key)) {
        pending.add(key);
        plsChanged = true;
      }
    }
    const nextPending = [...pending];
    const before = pl.pendingKeys?.join(",") ?? "";
    pl.pendingKeys = nextPending;
    if (before !== nextPending.join(",")) plsChanged = true;
  }
  // pending-ключи, которые нашлись среди локальных треков (после досканирования)
  plsChanged = remapPending(result, tracks) || plsChanged;

  return { favPatches, statsPatches, playlists: plsChanged ? result : null, matched };
}

/** Пробует поставить недостающие треки плейлистов, если файлы появились локально */
export function remapPending(playlists: Playlist[], tracks: Track[]): boolean {
  const byKey = new Map(tracks.map((t) => [trackKey(t), t]));
  let changed = false;
  for (const pl of playlists) {
    const pending = pl.pendingKeys;
    if (!pending || !pending.length) continue;
    const left: string[] = [];
    for (const key of pending) {
      const t = byKey.get(key);
      if (t && !pl.trackIds.includes(t.id)) {
        pl.trackIds.push(t.id);
        changed = true;
      } else if (!t) {
        left.push(key);
      }
    }
    pl.pendingKeys = left;
  }
  return changed;
}

function uidSafe(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return "pl_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

/* ---------------- сканирование сети ---------------- */

export async function fetchInfo(ip: string, port: number, timeoutMs: number): Promise<PeerInfo | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`http://${ip}:${port}/volna/info`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      app?: string;
      proto?: number;
      deviceId?: string;
      deviceName?: string;
      deviceType?: DeviceType;
      rev?: string;
    };
    if (!j || j.app !== "volna" || !j.deviceId) return null;
    return {
      deviceId: j.deviceId,
      name: j.deviceName || "Устройство",
      type: j.deviceType === "pc" ? "pc" : j.deviceType === "mobile" ? "mobile" : "web",
      ip,
      port,
      rev: j.rev || "",
      lastSeen: Date.now(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function ipToPrefix(ip: string): string | null {
  const m = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/);
  return m ? m[1] : null;
}

export type ProbeKind = "timeout" | "network";

/** fetchInfo с различением причины сбоя — для диагностики подключения */
export async function probeInfo(
  ip: string,
  port: number,
  timeoutMs: number
): Promise<{ info: PeerInfo | null; kind: ProbeKind | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`http://${ip}:${port}/volna/info`, { signal: ctrl.signal });
    if (!res.ok) return { info: null, kind: "network" };
    const j = (await res.json()) as {
      app?: string;
      proto?: number;
      deviceId?: string;
      deviceName?: string;
      deviceType?: DeviceType;
      rev?: string;
    };
    if (!j || j.app !== "volna" || !j.deviceId) return { info: null, kind: "network" };
    const info: PeerInfo = {
      deviceId: j.deviceId,
      name: j.deviceName || "Устройство",
      type: j.deviceType === "pc" ? "pc" : j.deviceType === "mobile" ? "mobile" : "web",
      ip,
      port,
      rev: j.rev || "",
      lastSeen: Date.now(),
    };
    return { info, kind: null };
  } catch (e) {
    const timeout = e instanceof DOMException && e.name === "AbortError";
    return { info: null, kind: timeout ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

/** Сканирует /24 подсеть на наличие серверов Волны */
export async function scanSubnet(localIp: string, selfId: string): Promise<PeerInfo[]> {
  const prefix = ipToPrefix(localIp);
  if (!prefix) return [];
  const found: PeerInfo[] = [];
  let idx = 1;
  const workers = Array.from({ length: 48 }, async () => {
    while (idx <= 254) {
      const n = idx++;
      const res = await fetchInfo(`${prefix}.${n}`, SYNC_PORT, 400);
      if (res && res.deviceId !== selfId) found.push(res);
    }
  });
  await Promise.all(workers);
  return found;
}

export type SnapshotResult = { ok: true; snap: SyncSnapshot } | { ok: false; unauthorized: boolean };

export async function fetchSnapshot(peer: PeerInfo): Promise<SnapshotResult> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`http://${peer.ip}:${peer.port}/volna/snapshot`, {
      signal: ctrl.signal,
      headers: peer.token ? { "x-volna-token": peer.token } : {},
    });
    clearTimeout(timer);
    if (res.status === 401) return { ok: false, unauthorized: true };
    if (!res.ok) return { ok: false, unauthorized: false };
    const j = (await res.json()) as SyncSnapshot;
    if (!j || typeof j.rev !== "string" || !Array.isArray(j.tracks)) return { ok: false, unauthorized: false };
    return { ok: true, snap: j };
  } catch {
    return { ok: false, unauthorized: false };
  }
}

export async function pushSnapshot(peer: PeerInfo, snap: SyncSnapshot): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(`http://${peer.ip}:${peer.port}/volna/snapshot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(peer.token ? { "x-volna-token": peer.token } : {}),
      },
      body: JSON.stringify(snap),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export function isKnownDevice(id: string): boolean {
  return knownSet().has(id);
}

export function markKnown(id: string): void {
  addKnown(id);
}

/* ---------------- UDP-поиск ПК (анонсы, как в LocalSend) ---------------- */

export interface DiscoveredPc {
  ip: string;
  port: number;
  deviceId: string;
  name: string;
  seenAt: number;
}

/**
 * Итог последнего поиска: found — ПК отвечает; foundBlocked — ПК слышен по
 * UDP, но HTTP-порт закрыт (firewall); none — не найдено.
 */
export type ScanStatus = "idle" | "found" | "foundBlocked" | "none";

interface DiscoveredResult {
  pc?: DiscoveredPc;
}

/** Запустить UDP-слушатель анонсов ПК (Android). Возвращает true, если слушает. */
export async function startDiscovery(): Promise<boolean> {
  if (!isMobilePlatform()) return false;
  try {
    const { SyncPlugin } = await import("../plugins/sync");
    const r = (await SyncPlugin.startDiscovery()) as unknown as { ok?: boolean } | undefined;
    return !!r?.ok;
  } catch {
    return false;
  }
}

export async function stopDiscovery(): Promise<void> {
  if (!isMobilePlatform()) return;
  try {
    const { SyncPlugin } = await import("../plugins/sync");
    await SyncPlugin.stopDiscovery();
  } catch {
    /* ignore */
  }
}

/** Последний ПК, услышанный по UDP-анонсам (или null) */
export async function getDiscoveredPeer(): Promise<DiscoveredPc | null> {
  if (!isMobilePlatform()) return null;
  try {
    const { SyncPlugin } = await import("../plugins/sync");
    const r = (await SyncPlugin.getDiscovered()) as unknown as DiscoveredResult | undefined;
    return r?.pc ?? null;
  } catch {
    return null;
  }
}
