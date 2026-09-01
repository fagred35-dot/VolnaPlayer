import type { RepeatMode } from "./types";

export interface FolderFile {
  rel: string;
  size: number;
  mtimeMs: number;
}

export interface FolderScan {
  path: string;
  name: string;
  files: FolderFile[];
  /** true, если найдено больше 5000 файлов и обход остановлен досрочно */
  truncated?: boolean;
}

export interface TagInfo {
  title: string | null;
  artist: string | null;
  album: string | null;
  duration: number;
  coverHash: string | null;
}

export interface MiniPlayerState {
  title: string;
  artist: string;
  art: string | null;
  playing: boolean;
  /** текущая позиция и длительность — для прогресс-бара оверлея */
  time?: number;
  duration?: number;
}

/** Результат поиска на YouTube (yt-dlp ytsearch) */
export interface DlSearchResult {
  url: string;
  title: string;
  channel: string;
  duration: number;
  thumb: string | null;
}

/** Метаданные по ссылке (без скачивания) */
export interface DlMeta {
  title: string | null;
  channel: string;
  duration: number;
  thumb: string | null;
}

/** Снапшот состояния плеера для MCP (рендерер → main → ИИ-агент) */
export interface McpSnapshot {
  ts: number;
  current: {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
    fav: boolean;
    cover: string | null;
    path: string | null;
  } | null;
  playing: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  speed: number;
  eq: { enabled: boolean; preset: string };
  librarySize: number;
  tracks: Array<{ id: string; title: string; artist: string; album: string; duration: number; fav: boolean }>;
  queue: string[];
  playlists: Array<{ id: string; name: string; trackIds: string[] }>;
  downloads: Array<{ title: string; state: string; percent: number }>;
  timerEnd: number | null;
  folder: string | null;
}

/** Команда MCP-сервера рендереру (main → renderer-command) */
export interface McpCommand {
  __mcp?: number;
  type: string;
  id?: string;
  value?: unknown;
  seconds?: number;
  minutes?: number;
  url?: string;
  title?: string;
}

/** Данные о MCP-сервере для настроек (кнопка «Подключить MCP») */
export interface McpInfo {
  enabled: boolean;
  port: number | null;
  bridgePath: string;
  config: string;
}

declare global {
  interface Window {
    volna?: {
      platform: string;
      pickFolder: () => Promise<FolderScan | null>;
      scanFolder: (path: string) => Promise<FolderScan | null>;
      getTags: (paths: string[]) => Promise<Record<string, TagInfo | undefined>>;
      openInExplorer: (path: string) => Promise<void>;
      /** удалить файл с диска (только из разрешённых папок) */
      deleteFile: (path: string) => Promise<{ ok: boolean; error?: string }>;
      /** мини-плеер */
      miniOpen: () => Promise<void>;
      miniCommand: (cmd: string) => void;
      sendMiniState: (state: MiniPlayerState) => void;
      /** изменить размер окна оверлея (из пресетов вида) */
      miniResize: (w: number, h: number) => void;
      /** глобальный хоткей Ctrl+Alt+M — режим перемещения оверлея */
      onMiniMoveMode: (cb: () => void) => () => void;
      onRendererCommand: (cb: (cmd: string | McpCommand) => void) => () => void;
      /** снапшот состояния плеера для MCP-сервера (управление ИИ-агентом) */
      sendMcpState: (state: McpSnapshot | Pick<McpSnapshot, "ts" | "playing" | "time">) => void;
      /** данные для кнопки «Подключить MCP»: порт, путь моста, готовый конфиг */
      getMcpInfo: () => Promise<McpInfo>;
      onMiniState: (cb: (state: MiniPlayerState) => void) => () => void;
      /** открыто ли окно мини-плеера */
      onMiniVisible: (cb: (visible: boolean) => void) => () => void;
      /** кастомный titlebar */
      windowControls: (action: "minimize" | "maximize" | "close") => void;
      onWindowState: (cb: (maximized: boolean) => void) => () => void;
      isMaximized: () => Promise<boolean>;
      /** прозрачность и размытие основного окна */
      getWindowPrefs: () => Promise<{ transparent: boolean; material: "none" | "acrylic" | "mica" }>;
      setWindowPrefs: (patch: { transparent?: boolean; material?: "none" | "acrylic" | "mica" }) => Promise<{
        transparent: boolean;
        material: "none" | "acrylic" | "mica";
      }>;
      /** Discord Rich Presence */
      rpcUpdate: (d: { title: string; artist: string; playing: boolean; end?: number | null }) => void;
      setRpcEnabled: (on: boolean) => void;
      /** скачивание аудио по ссылке (yt-dlp); destDir — папка, куда сохранить */
      dlStart: (url: string, destDir?: string) => Promise<{ ok: boolean }>;
      /** поиск треков на YouTube по названию */
      dlSearch: (query: string) => Promise<DlSearchResult[]>;
      /** метаданные по ссылке (название/обложка/канал) */
      dlMeta: (url: string) => Promise<DlMeta | null>;
      /** отменить активное скачивание */
      dlCancel: () => Promise<void>;
      onDlProgress: (cb: (p: { percent: number; status: string }) => void) => () => void;
      onDlDone: (
        cb: (d: { path: string; title: string; artist?: string; album?: string; duration?: number; coverHash?: string | null }) => void
      ) => () => void;
      onDlError: (cb: (d: { message: string }) => void) => () => void;
    };
  }
}

export {};
