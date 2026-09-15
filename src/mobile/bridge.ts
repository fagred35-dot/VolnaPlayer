import { Capacitor, registerPlugin } from "@capacitor/core";
import { Filesystem } from "@capacitor/filesystem";
import * as mm from "music-metadata";
import type { DeviceAudioTrack, DlMeta, DlSearchResult, FolderScan, TagInfo } from "../electron.d";
import { isMobilePlatform } from "../lib/platform";
import { saveCover } from "../lib/covers";

/* нативный плагин загрузчика (VolnaYtdlPlugin.java) */
const VolnaYtdl = registerPlugin("VolnaYtdl") as {
  start: (o: { url: string; destDir?: string }) => Promise<void>;
  search: (o: { query: string }) => Promise<{ results?: DlSearchResult[] }>;
  meta: (o: { url: string }) => Promise<unknown>;
  cancel: () => Promise<void>;
  addListener: (ev: string, cb: (d: never) => void) => Promise<{ remove: () => void }>;
};

/**
 * Мобильный полифилл window.volna (Capacitor Android/iOS).
 * Реализует подмножество Electron-моста, которое нужно плееру:
 * скан папки, теги, удаление файла, URL файла для WebView.
 * Десктоп-функции (оверлей, Discord RPC, MCP, yt-dlp) — безопасные заглушки.
 */

const MAX_FILES = 5000;

const AUDIO_EXT = /\.(mp3|flac|wav|ogg|oga|m4a|aac|opus|webm|wma)$/i;

function baseName(p: string): string {
  const parts = p.replace(/[\\/]+$/, "").split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

async function ensureStoragePermission(): Promise<boolean> {
  try {
    const perm = await Filesystem.checkPermissions();
    if (perm.publicStorage === "granted") return true;
    const req = await Filesystem.requestPermissions();
    return req.publicStorage === "granted";
  } catch {
    return true; // на некоторых версиях API недоступно — пробуем без него
  }
}

/** Запрос доступа к музыке на устройстве (для пикера папок) */
export async function requestStoragePermission(): Promise<boolean> {
  return ensureStoragePermission();
}

/** Рекурсивный обход папки; rel — путь ОТНОСИТЕЛЬНО корня сканирования */
async function walk(root: string, dir: string, out: FolderScan["files"], state: { count: number }): Promise<void> {
  if (state.count >= MAX_FILES) return;
  let entries;
  try {
    entries = await Filesystem.readdir({ path: dir });
  } catch {
    return; // нет доступа / папка исчезла
  }
  const dirs: string[] = [];
  for (const e of entries.files) {
    const full = `${dir.replace(/[\\/]+$/, "")}/${e.name}`;
    if (e.type === "directory") {
      dirs.push(full);
    } else if (AUDIO_EXT.test(e.name)) {
      // useTracks склеивает путь как joinAbs(root, rel) — rel обязан быть относительным
      const rel = full.length > root.length + 1 ? full.slice(root.length + 1) : e.name;
      out.push({ rel, size: e.size ?? 0, mtimeMs: e.mtime ? new Date(e.mtime).getTime() : 0 });
      state.count++;
      if (state.count >= MAX_FILES) return;
    }
  }
  for (const d of dirs) {
    await walk(root, d, out, state);
    if (state.count >= MAX_FILES) return;
  }
}

async function scanFolder(path: string): Promise<FolderScan | null> {
  const ok = await ensureStoragePermission();
  if (!ok) return null;
  const root = path.replace(/[\\/]+$/, "");
  const files: FolderScan["files"] = [];
  const state = { count: 0 };
  await walk(root, root, files, state);
  return { path: root, name: baseName(root), files, truncated: state.count >= MAX_FILES };
}

/** Папка по умолчанию: Music → Download на общей памяти устройства */
async function pickDefaultFolder(): Promise<FolderScan | null> {
  const ok = await ensureStoragePermission();
  if (!ok) return null;
  const candidates = ["/storage/emulated/0/Music", "/storage/emulated/0/Download"];
  for (const dir of candidates) {
    try {
      const entries = await Filesystem.readdir({ path: dir });
      if (entries.files.length) return await scanFolder(dir);
    } catch {
      /* папки нет — пробуем следующую */
    }
  }
  return null;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Читает теги файла (включая встроенную обложку) через music-metadata */
async function readTags(path: string): Promise<TagInfo | undefined> {
  try {
    const res = await Filesystem.readFile({ path });
    const bytes = b64ToBytes(res.data as string);
    let meta;
    try {
      meta = await mm.parseBlob(new Blob([bytes.slice().buffer as ArrayBuffer]), { duration: false });
    } catch {
      return undefined; // не аудио или формат не разобрался — теги нет, имя файла остаётся
    }
    let coverHash: string | null = null;
    const pic = meta.common.picture?.[0];
    if (pic && pic.data.length < 4_000_000) {
      try {
        coverHash = await saveCover(pic.data, pic.format || "image/jpeg");
      } catch {
        /* обложка не критична */
      }
    }
    return {
      title: meta.common.title ?? null,
      artist: meta.common.artist ?? null,
      album: meta.common.album ?? null,
      duration: meta.format.duration ?? 0,
      coverHash,
    };
  } catch {
    return undefined;
  }
}

async function getTags(paths: string[]): Promise<Record<string, TagInfo | undefined>> {
  const out: Record<string, TagInfo | undefined> = {};
  for (const p of paths) out[p] = await readTags(p);
  return out;
}

const noopUnsub = () => undefined;

/* ---------- события встроенного загрузчика ---------- */
type DlProgress = { percent: number; status: string };
type DlDone = { path: string; title: string };
const dlProgressCbs = new Set<(p: DlProgress) => void>();
const dlDoneCbs = new Set<(d: DlDone) => void>();
const dlErrorCbs = new Set<(d: { message: string }) => void>();

/**
 * Устанавливает мобильный window.volna. Вызывается импортом src/mobile/bridge
 * в main.tsx до монтирования React.
 */
export function installMobileBridge(): void {
  if (!isMobilePlatform() || window.volna) return;

  /* подписка на события yt-dlp — один раз на всё приложение */
  void VolnaYtdl.addListener("progress", (d: unknown) => {
    dlProgressCbs.forEach((cb) => cb(d as DlProgress));
  });
  void VolnaYtdl.addListener("done", (d: unknown) => {
    dlDoneCbs.forEach((cb) => cb(d as DlDone));
  });
  void VolnaYtdl.addListener("error", (d: unknown) => {
    dlErrorCbs.forEach((cb) => cb(d as { message: string }));
  });

  window.volna = {
    platform: Capacitor.getPlatform(), // "android" | "ios"
    pickFolder: () => pickDefaultFolder(),
    scanFolder: (p) => scanFolder(p),
    getTags,
    openInExplorer: () => Promise.resolve(),
    deleteFile: async (path) => {
      try {
        await Filesystem.deleteFile({ path });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    /** абсолютный путь → URL, который можно проиграть в WebView */
    fileUrl: (path) => Capacitor.convertFileSrc(path),
    miniOpen: () => Promise.resolve(),
    miniCommand: () => undefined,
    sendMiniState: () => undefined,
    miniResize: () => undefined,
    onMiniMoveMode: () => noopUnsub,
    onRendererCommand: () => noopUnsub,
    sendMcpState: () => undefined,
    getMcpInfo: () => Promise.resolve({ enabled: false, port: null, bridgePath: "", config: "" }),
    onMiniState: () => noopUnsub,
    onMiniVisible: () => noopUnsub,
    windowControls: () => undefined,
    onWindowState: () => noopUnsub,
    isMaximized: () => Promise.resolve(false),
    getWindowPrefs: () => Promise.resolve({ transparent: false, material: "none" }),
    setWindowPrefs: () => Promise.resolve({ transparent: false, material: "none" }),
    rpcUpdate: () => undefined,
    setRpcEnabled: () => undefined,
    // скачивание музыки по ссылке — встроенный yt-dlp (youtubedl-android)
    dlStart: (url, destDir) =>
      new Promise((resolve) => {
        let offDone: { remove: () => void } | null = null;
        let offError: { remove: () => void } | null = null;
        const finish = () => {
          offDone?.remove();
          offError?.remove();
          resolve({ ok: true });
        };
        void VolnaYtdl.addListener("done", () => finish()).then((h) => {
          if (offDone === null) offDone = h;
          else h.remove();
        });
        void VolnaYtdl.addListener("error", () => finish()).then((h) => {
          if (offError === null) offError = h;
          else h.remove();
        });
        VolnaYtdl.start({ url, destDir: destDir ?? "" }).catch(() => {
          offDone?.remove();
          offError?.remove();
          resolve({ ok: false });
        });
      }),
    dlSearch: async (query) => {
      try {
        const r = await VolnaYtdl.search({ query });
        return r.results ?? [];
      } catch {
        return [];
      }
    },
    dlMeta: async (url) => {
      try {
        const r = (await VolnaYtdl.meta({ url })) as unknown as DlMeta | null;
        return r ?? null;
      } catch {
        return null;
      }
    },
    dlCancel: () => VolnaYtdl.cancel(),
    onDlProgress: (cb) => {
      dlProgressCbs.add(cb);
      return () => dlProgressCbs.delete(cb);
    },
    onDlDone: (cb) => {
      dlDoneCbs.add(cb);
      return () => dlDoneCbs.delete(cb);
    },
    onDlError: (cb) => {
      dlErrorCbs.add(cb);
      return () => dlErrorCbs.delete(cb);
    },
    /** ---- синхронизация: сервера на телефоне нет, только клиент ---- */
    syncStatus: async () => {
      let localIp: string | null = null;
      try {
        const { SyncPlugin } = await import("../plugins/sync");
        localIp = (await SyncPlugin.getIp()).ip;
      } catch {
        /* нет нативного плагина */
      }
      return { running: false, port: null, localIp, deviceName: "Телефон" };
    },
    syncOpenPort: () => Promise.resolve(false),
    /** MediaStore: вся аудиобиблиотека устройства (Android) */
    listAllAudio: async () => {
      try {
        const { SyncPlugin } = await import("../plugins/sync");
        const res = (await SyncPlugin.listAudio()) as unknown as { tracks: DeviceAudioTrack[] };
        return res?.tracks ?? [];
      } catch {
        return [];
      }
    },
    syncPublish: () => undefined,
    onSyncIncoming: () => noopUnsub,
    /** версия сборки из PackageManager (для «О приложении» и sync-анонсов) */
    getAppVersion: async () => {
      try {
        const { SyncPlugin } = await import("../plugins/sync");
        const r = (await SyncPlugin.getAppVersion()) as unknown as { version: string; build: number };
        return { version: r?.version ?? "", build: Number(r?.build ?? 0) };
      } catch {
        return { version: "", build: 0 };
      }
    },
    /** последний нативный сбой — можно скопировать из «Настроек» */
    getCrashLog: async () => {
      try {
        const { SyncPlugin } = await import("../plugins/sync");
        const r = (await SyncPlugin.getCrashLog()) as unknown as { text?: string };
        return { text: r?.text ?? "" };
      } catch {
        return { text: "" };
      }
    },
    clearCrashLog: async () => {
      try {
        const { SyncPlugin } = await import("../plugins/sync");
        const r = (await SyncPlugin.clearCrashLog()) as unknown as { ok?: boolean };
        return { ok: !!r?.ok };
      } catch {
        return { ok: false };
      }
    },
  };
}
