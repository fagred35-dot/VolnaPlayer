/**
 * Хранилище встроенных обложек для мобильной версии.
 * Electron хранит обложки в main-процессе и отдаёт через volna://cover/<hash>.
 * На мобильных обложки извлекаются из тегов (music-metadata) и складываются
 * в отдельную IndexedDB "volna-covers".
 */

const DB_NAME = "volna-covers";
const DB_VER = 1;
const STORE = "covers";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

/** SHA-256 от байтов обложки → короткий hex-хэш */
async function coverHashOf(bytes: Uint8Array): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
    const arr = new Uint8Array(buf);
    let hex = "";
    for (let i = 0; i < 10; i++) hex += arr[i].toString(16).padStart(2, "0");
    return hex;
  } catch {
    let h = 5381;
    for (let i = 0; i < bytes.length; i++) h = ((h << 5) + h + bytes[i]) >>> 0;
    return "f_" + h.toString(16);
  }
}

/** Целостность изображения: JPEG обязан кончаться EOI (FFD9), PNG — содержать IEND.
 *  Обрезанные байты декодируются частично — «обложка наполовину». */
function imageComplete(bytes: Uint8Array, mime: string): boolean {
  if (bytes.length < 24) return false;
  const isPng =
    mime.includes("png") ||
    (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47);
  if (isPng) {
    for (let i = bytes.length - 8; i >= bytes.length - 16 && i >= 0; i--) {
      if (bytes[i] === 0x49 && bytes[i + 1] === 0x45 && bytes[i + 2] === 0x4e && bytes[i + 3] === 0x44) {
        return true;
      }
    }
    return false;
  }
  // JPEG: EOI в самом конце (допускаем нулевой паддинг после него)
  let i = bytes.length - 1;
  while (i > 0 && bytes[i] === 0x00) i--;
  return i > 0 && bytes[i - 1] === 0xff && bytes[i] === 0xd9;
}

/** Сохранить обложку, вернуть её хэш. Обрезанное изображение бросает ошибку —
 *  вызывающий код оставит coverHash пустым и трек возьмёт обложку из интернета. */
export async function saveCover(bytes: Uint8Array, mime: string): Promise<string> {
  if (!imageComplete(bytes, mime)) throw new Error("cover image is truncated");
  const hash = await coverHashOf(bytes);
  const exists = await tx<Blob | undefined>("readonly", (s) => s.get(hash));
  if (!exists) await tx("readwrite", (s) => s.put(new Blob([bytes.slice()], { type: mime }), hash));
  return hash;
}

const urlCache = new Map<string, string>();

/** Object URL обложки по хэшу (кэшируется на время сессии) */
export async function getCoverUrl(hash: string): Promise<string | null> {
  const hit = urlCache.get(hash);
  if (hit) return hit;
  try {
    const blob = await tx<Blob | undefined>("readonly", (s) => s.get(hash));
    if (!blob) return null;
    const buf = new Uint8Array(await blob.arrayBuffer());
    // битая (обрезанная) запись — считаем, что обложки нет
    if (!imageComplete(buf, blob.type || "image/jpeg")) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(hash, url);
    return url;
  } catch {
    return null;
  }
}

/** Сырые байты обложки + mime — для нативных потребителей (медиа-уведомление) */
export async function getCoverBytes(hash: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const blob = await tx<Blob | undefined>("readonly", (s) => s.get(hash));
    if (!blob) return null;
    const buf = new Uint8Array(await blob.arrayBuffer());
    if (!imageComplete(buf, blob.type || "image/jpeg")) return null;
    return { bytes: buf, mime: blob.type || "image/jpeg" };
  } catch {
    return null;
  }
}

/* ======================================================================
 *  Собственный извлекатель встроенной обложки из аудиофайла.
 *  music-metadata местами отдаёт обрезанные байты картинки (обложка
 *  рисуется наполовину), поэтому читаем теги сами: точные диапазоны
 *  файла → гарантированно полные данные.
 *  Поддержка: MP3 (ID3v2.2/2.3/2.4 APIC), FLAC (PICTURE), MP4/M4A (covr).
 * ==================================================================== */

export interface RawCover {
  bytes: Uint8Array;
  mime: string;
}

const u8 = (a: Uint8Array, i: number) => a[i];
const be32 = (a: Uint8Array, i: number) => ((a[i] << 24) | (a[i + 1] << 16) | (a[i + 2] << 8) | a[i + 3]) >>> 0;
const be24 = (a: Uint8Array, i: number) => ((a[i] << 16) | (a[i + 1] << 8) | a[i + 2]) >>> 0;
const ss32 = (a: Uint8Array, i: number) =>
  (((a[i] & 0x7f) << 21) | ((a[i + 1] & 0x7f) << 14) | ((a[i + 2] & 0x7f) << 7) | (a[i + 3] & 0x7f)) >>> 0;

const mimeOf = (raw: string): string => {
  const m = raw.trim().toLowerCase();
  if (!m || m === "jpg" || m === "jpeg" || m === "image/jpg") return "image/jpeg";
  if (m === "png" || m === "image/png") return "image/png";
  if (m === "image/webp") return "image/webp";
  return m.startsWith("image/") ? m : "image/jpeg";
};

function asciiAt(a: Uint8Array, off: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(a[off + i]);
  return s;
}

/** ID3 unsynchronisation: FF 00 → FF */
function deUnsync(a: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    out[n++] = a[i];
    if (a[i] === 0xff && a[i + 1] === 0x00) i++;
  }
  return out.subarray(0, n);
}

/** latin1-строка до нуля; возвращает [строка, следующее смещение] */
function latin1Z(a: Uint8Array, off: number): [string, number] {
  let end = off;
  while (end < a.length && a[end] !== 0) end++;
  return [asciiAt(a, off, end - off), Math.min(end + 1, a.length)];
}

/** UTF-16 (с BOM/без) или UTF-8 строка до терминатора по кодировке ID3 */
function textZ(a: Uint8Array, off: number, enc: number): [string, number] {
  if (enc === 1 || enc === 2) {
    const step = 2;
    let end = off;
    // пропускаем BOM, ищем 00 00 на границе символа
    while (end + 1 < a.length && !(a[end] === 0 && a[end + 1] === 0)) end += step;
    const body = a.subarray(off, Math.min(end, a.length));
    try {
      const label = enc === 1 && body[0] === 0xff ? "utf-16" : enc === 1 ? "utf-16le" : "utf-16be";
      return [new TextDecoder(label).decode(body), Math.min(end + 2, a.length)];
    } catch {
      return ["", Math.min(end + 2, a.length)];
    }
  }
  const [s, next] = latin1Z(a, off);
  if (enc === 3) {
    try {
      // utf8: перечитываем до терминатора как utf-8
      let end = off;
      while (end < a.length && a[end] !== 0) end++;
      return [new TextDecoder("utf-8").decode(a.subarray(off, end)), Math.min(end + 1, a.length)];
    } catch {
      return [s, next];
    }
  }
  return [s, next];
}

async function id3v2Cover(file: Blob): Promise<RawCover | null> {
  const hdr = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (hdr.length < 10 || u8(hdr, 0) !== 0x49 || u8(hdr, 1) !== 0x44 || u8(hdr, 2) !== 0x33) return null;
  const ver = u8(hdr, 3);
  const flags = u8(hdr, 5);
  const tagSize = ss32(hdr, 6);
  let tag = new Uint8Array(await file.slice(10, 10 + tagSize).arrayBuffer());
  if (flags & 0x80) tag = deUnsync(tag);
  let off = 0;
  if (flags & 0x40) {
    // расширенный заголовок: v2.4 — syncsafe-размер включает себя, v2.3 — обычный и не включает
    if (ver >= 4) off += ss32(tag, 0);
    else off += 4 + be32(tag, 0);
  }
  const idLen = ver <= 2 ? 3 : 4;
  const hdrLen = ver <= 2 ? 6 : 10;
  let first: RawCover | null = null;

  while (off + hdrLen <= tag.length) {
    const id = asciiAt(tag, off, idLen);
    if (!/^[A-Z0-9]+$/.test(id)) break;
    let fsize: number;
    if (ver <= 2) fsize = be24(tag, off + 3);
    else fsize = ver === 4 ? ss32(tag, off + 4) : be32(tag, off + 4);
    if (fsize <= 0 || off + hdrLen + fsize > tag.length + 1) break;
    const bodyOff = off + hdrLen;
    let body = tag.subarray(bodyOff, bodyOff + fsize);
    if (ver === 4 && u8(tag, off + 9) & 0x02) body = deUnsync(body); // frame-level unsync

    if ((ver <= 2 && id === "PIC") || (ver >= 3 && id === "APIC")) {
      const enc = u8(body, 0);
      let p = 1;
      let mime: string;
      if (ver <= 2) {
        mime = mimeOf(asciiAt(body, 1, 3));
        p = 4;
      } else {
        const [m, n] = latin1Z(body, p);
        mime = mimeOf(m);
        p = n;
      }
      const picType = u8(body, p);
      p += 1;
      const [, p2] = textZ(body, p, enc); // description
      p = p2;
      const bytes = body.subarray(p);
      if (bytes.length > 16) {
        const cand: RawCover = { bytes, mime };
        if (picType === 3) return cand; // front cover
        first ??= cand;
      }
    }
    off = bodyOff + fsize;
  }
  return first;
}

async function flacCover(file: Blob): Promise<RawCover | null> {
  let off = 4; // "fLaC"
  for (;;) {
    const h = new Uint8Array(await file.slice(off, off + 4).arrayBuffer());
    if (h.length < 4) return null;
    const last = (u8(h, 0) & 0x80) !== 0;
    const type = u8(h, 0) & 0x7f;
    const len = be24(h, 1);
    if (type === 6) {
      const b = new Uint8Array(await file.slice(off + 4, off + 4 + len).arrayBuffer());
      if (b.length < 32) return null;
      let p = 4; // pic type u32
      const mimeLen = be32(b, p);
      p += 4;
      const mime = mimeOf(asciiAt(b, p, mimeLen));
      p += mimeLen;
      const descLen = be32(b, p);
      p += 4 + descLen + 16; // description + w/h/depth/colors
      const dataLen = be32(b, p);
      p += 4;
      const bytes = b.subarray(p, p + dataLen);
      return bytes.length > 16 ? { bytes, mime } : null;
    }
    if (last) return null;
    off += 4 + len;
  }
}

function findAtom(a: Uint8Array, start: number, end: number, name: string): [number, number] | null {
  let off = start;
  while (off + 8 <= end) {
    const size = be32(a, off);
    const type = asciiAt(a, off + 4, 4);
    if (size < 8) return null;
    if (type === name) return [off, Math.min(off + size, end)];
    off += size;
  }
  return null;
}

async function mp4Cover(file: Blob): Promise<RawCover | null> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const moov = findAtom(buf, 0, buf.length, "moov");
  if (!moov) return null;
  const udta = findAtom(buf, moov[0] + 8, moov[1], "udta");
  if (!udta) return null;
  // 'meta' содержит 4 байта version/flags перед детьми
  const meta = findAtom(buf, udta[0] + 8, udta[1], "meta");
  if (!meta) return null;
  const ilst = findAtom(buf, meta[0] + 12, meta[1], "ilst");
  if (!ilst) return null;
  const covr = findAtom(buf, ilst[0] + 8, ilst[1], "covr");
  if (!covr) return null;
  const data = findAtom(buf, covr[0] + 8, covr[1], "data");
  if (!data) return null;
  const flags = be32(buf, data[0] + 8); // ver/flags: 13 = jpeg, 14 = png
  const mime = flags === 14 ? "image/png" : "image/jpeg";
  const bytes = buf.subarray(data[0] + 16, data[1]);
  return bytes.length > 16 ? { bytes, mime } : null;
}

/** Встроенная обложка из аудиофайла (полные байты) либо null */
export async function extractCoverFromAudio(file: Blob): Promise<RawCover | null> {
  try {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (head.length >= 4 && u8(head, 0) === 0x49 && u8(head, 1) === 0x44 && u8(head, 2) === 0x33) {
      return await id3v2Cover(file);
    }
    if (head.length >= 4 && u8(head, 0) === 0x66 && u8(head, 1) === 0x4c && u8(head, 2) === 0x61 && u8(head, 3) === 0x43) {
      return await flacCover(file);
    }
    if (head.length >= 8 && u8(head, 4) === 0x66 && u8(head, 5) === 0x74 && u8(head, 6) === 0x79 && u8(head, 7) === 0x70) {
      return await mp4Cover(file);
    }
    // без чёткого маркера пробуем по очереди
    return (await id3v2Cover(file)) ?? (await flacCover(file)) ?? (await mp4Cover(file));
  } catch {
    return null;
  }
}
