export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  addedAt: number;
  fav: boolean;
  fileName: string;
  fileSize: number;
  /** timestamp последнего изменения (File.lastModified) — для точной дедупликации */
  fileLastModified?: number;
  /** абсолютный путь к файлу (только для треков из выбранной папки, Electron) */
  path?: string;
  /** корень выбранной папки */
  folder?: string;
  /** хэш встроенной обложки (хранится в main-процессе, отдаётся через volna://cover/) */
  coverHash?: string;
  /** время изменения файла — для синхронизации папки */
  fileMtime?: number;
}

export interface StoredTrack extends Track {
  blob?: Blob;
}

export type RepeatMode = "off" | "all" | "one";
export type SortKey = "order" | "title" | "artist" | "album" | "duration" | "added";

export interface Toast {
  id: number;
  text: string;
  icon?: string;
}

export interface EqState {
  enabled: boolean;
  gains: number[];
  preset: string;
}

export const EQ_FREQS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];

export interface EqPreset {
  name: string;
  gains: number[];
}

export const EQ_PRESETS: EqPreset[] = [
  { name: "Плоский", gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: "Басы", gains: [7, 5, 3, 1, 0, 0, 0, 0, 0, 0] },
  { name: "Рок", gains: [5, 4, 3, 1, -1, -1, 1, 3, 4, 5] },
  { name: "Поп", gains: [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2] },
  { name: "Джаз", gains: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3] },
  { name: "Классика", gains: [4, 3, 2, 0, -1, -1, 0, 2, 3, 4] },
  { name: "Электро", gains: [5, 4, 0, -2, -2, 0, 3, 4, 4, 5] },
  { name: "Вокал", gains: [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2] },
  { name: "Громкость", gains: [6, 4, 2, 0, 0, 2, 4, 6, 6, 6] },
];

export const ACCENTS = ["#8b5cf6", "#22d3ee", "#34d399", "#f59e0b", "#fb7185"];

export const AUDIO_EXT = /\.(mp3|flac|wav|ogg|oga|m4a|aac|opus|webm|wma)$/i;

export function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

/** Стабильный id для треков из папки: не меняется между перезапусками */
export function hashId(...parts: string[]): string {
  let h = 5381;
  const s = parts.join("\u0000");
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return "f_" + h.toString(16) + "_" + s.length.toString(16);
}
