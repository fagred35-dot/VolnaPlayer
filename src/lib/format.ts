export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

export function formatTotal(sec: number): string {
  if (sec < 3600) return formatTime(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `${h} ч ${m} мин`;
}

export function parseFileName(name: string): { title: string; artist: string } {
  const base = name.replace(/\.[^.]+$/, "");
  const cleaned = base
    .replace(/\s*[\[\(（].*?[\]\)）]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const m = cleaned.match(/^(.+?)\s*[-–—~]\s*(.+)$/);
  if (m && m[1].length > 1 && m[2].length > 0) {
    return { artist: m[1].trim(), title: m[2].trim() };
  }
  return { artist: "", title: cleaned || base };
}

export function huePairFromId(id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return [h % 360, (h * 7 + 40) % 360];
}

export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export function isAudioFile(file: File): boolean {
  return file.type.startsWith("audio/") || /\.(mp3|flac|wav|ogg|oga|m4a|aac|opus|webm|wma)$/i.test(file.name);
}
