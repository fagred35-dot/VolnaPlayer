/**
 * Лог приложения: ring buffer + подписка + хвост в localStorage.
 * Виден в плавающей панели (LogBubble, Android) — для живой диагностики
 * синхронизации, обоев и ошибок JS на реальном устройстве.
 */

export interface LogEntry {
  ts: number;
  tag: string;
  msg: string;
  data?: unknown;
}

const MAX = 200;
const TAIL = 50;
const PERSIST_KEY = "volna.log.tail";

const entries: LogEntry[] = [];
const subs = new Set<() => void>();
let persistTimer: number | null = null;

try {
  const raw = localStorage.getItem(PERSIST_KEY);
  if (raw) {
    const parsed = JSON.parse(raw) as LogEntry[];
    if (Array.isArray(parsed)) entries.push(...parsed.slice(-TAIL));
  }
} catch {
  /* нет хвоста — не страшно */
}

function notify(): void {
  for (const s of subs) {
    try {
      s();
    } catch {
      /* ignore */
    }
  }
}

export function appLog(tag: string, msg: string, data?: unknown): void {
  entries.push({ ts: Date.now(), tag, msg, data });
  if (entries.length > MAX) entries.splice(0, entries.length - MAX);
  notify();
  if (persistTimer === null) {
    persistTimer = window.setTimeout(() => {
      persistTimer = null;
      try {
        localStorage.setItem(PERSIST_KEY, JSON.stringify(entries.slice(-TAIL)));
      } catch {
        /* приватный режим */
      }
    }, 3000);
  }
}

export function getLogEntries(): readonly LogEntry[] {
  return entries;
}

export function clearLog(): void {
  entries.length = 0;
  try {
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

export function subscribeLog(cb: () => void): () => void {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

export function formatLogEntry(e: LogEntry): string {
  const d = new Date(e.ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  let line = `${hh}:${mm}:${ss} [${e.tag}] ${e.msg}`;
  if (e.data !== undefined) {
    let extra: string;
    if (typeof e.data === "string") extra = e.data;
    else {
      try {
        extra = JSON.stringify(e.data);
      } catch {
        extra = "[unserializable]";
      }
    }
    line += " " + extra;
  }
  return line;
}

/** Глобальные ошибки JS — тоже в лог */
export function installGlobalErrorLogging(): void {
  window.addEventListener("error", (ev) => {
    appLog("js", ev.message || "error", `${ev.filename || ""}:${ev.lineno ?? ""}`);
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const r = (ev as PromiseRejectionEvent).reason;
    appLog("js", "unhandled rejection", r instanceof Error ? r.message : String(r));
  });
}
