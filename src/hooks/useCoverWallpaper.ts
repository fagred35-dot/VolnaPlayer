import { useEffect, useRef } from "react";
import { Directory, Filesystem } from "@capacitor/filesystem";
import type { Track } from "../types";
import { isMobilePlatform } from "../lib/platform";
import { getCoverBytes } from "../lib/covers";
import { getArt } from "../lib/art";
import { SyncPlugin } from "../plugins/sync";
import { appLog } from "../lib/applog";

/** Куда ставить обои: рабочий стол / экран блокировки / оба / выключено */
export type WallpaperTarget = "off" | "system" | "lock" | "both";
/** Сила размытия обложки (как в MusWall — чтобы иконки читались) */
export type WallpaperBlur = "off" | "low" | "mid" | "high";

const WALLPAPER_FILE = "volna-wallpaper.jpg";
/** Длинная сторона кадра — не больше (экономим память и время записи) */
const MAX_DIM = 1440;

function blurShare(b: WallpaperBlur): number {
  return b === "low" ? 0.02 : b === "mid" ? 0.05 : b === "high" ? 0.1 : 0;
}

async function loadBitmap(bytes: Uint8Array, mime: string): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(new Blob([bytes.slice()], { type: mime }));
    } catch {
      /* fallback ниже */
    }
  }
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type: mime }));
  try {
    return await new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("image decode failed"));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

/** Кадр обоев: cover-crop под экран + blur. Возвращает JPEG-blob. */
async function renderWallpaper(cover: { bytes: Uint8Array; mime: string }, blur: WallpaperBlur): Promise<Blob | null> {
  const src = await loadBitmap(cover.bytes, cover.mime);
  const sw = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const sh = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  if (!sw || !sh) return null;
  const scrW = Math.max(720, Math.floor(window.screen?.width ?? 360));
  const scrH = Math.max(1280, Math.floor(window.screen?.height ?? 800));
  const W0 = Math.min(scrW, scrH);
  const H0 = Math.max(scrW, scrH);
  const k = Math.min(1, MAX_DIM / H0);
  const W = Math.round(W0 * k);
  const H = Math.round(H0 * k);

  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  const scale = Math.max(W / sw, H / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);

  const share = blurShare(blur);
  if (share > 0) {
    const r = Math.max(2, Math.round(W * share));
    const tmp = document.createElement("canvas");
    tmp.width = W;
    tmp.height = H;
    const tctx = tmp.getContext("2d");
    if (tctx) {
      tctx.filter = `blur(${r}px)`;
      tctx.drawImage(cv, 0, 0);
      tctx.filter = "none";
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(tmp, 0, 0);
    }
  }
  return await new Promise<Blob | null>((res) => cv.toBlob((b) => res(b), "image/jpeg", 0.92));
}

async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Байты обложки: сначала встроенная (теги), затем сети (iTunes/Deezer) */
async function coverBytes(t: Track): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (t.coverHash) {
    const local = await getCoverBytes(t.coverHash);
    if (local && local.bytes.length) return local;
  }
  try {
    const url = await getArt(t);
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (!bytes.length) return null;
    return { bytes, mime: blob.type || "image/jpeg" };
  } catch {
    return null;
  }
}

interface Options {
  track: Track | null;
  playing: boolean;
  target: WallpaperTarget;
  blur: WallpaperBlur;
}

/**
 * Обои из обложки трека (MusWall-style, только Android):
 *  - трек заиграл / сменился → обои обновляются сразу (плюс тик раз в 5 с
 *    как страховка);
 *  - пауза/остановка/выключение настройки → возврат стандартных обоев
 *    из нативного бэкапа;
 *  - работает только пока жив процесс Волны.
 */
export function useCoverWallpaper({ track, playing, target, blur }: Options): void {
  const busy = useRef(false);
  const active = useRef(false);
  const applied = useRef("");
  const trackRef = useRef(track);
  trackRef.current = track;
  const confRef = useRef({ playing, target, blur });
  confRef.current = { playing, target, blur };

  useEffect(() => {
    if (!isMobilePlatform()) return;

    const restore = async () => {
      if (!active.current) return;
      active.current = false;
      applied.current = "";
      try {
        await SyncPlugin.restoreWallpaper();
        appLog("wp", "restored");
      } catch (e) {
        appLog("wp", "restore failed", e instanceof Error ? e.message : String(e));
      }
    };

    const apply = async (t: Track) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const cover = await coverBytes(t);
        if (!cover) {
          appLog("wp", "no cover bytes", t.title);
          return;
        }
        const blob = await renderWallpaper(cover, confRef.current.blur);
        if (!blob) {
          appLog("wp", "render failed", t.title);
          return;
        }
        const data = await blobToBase64(blob);
        await Filesystem.writeFile({ path: WALLPAPER_FILE, directory: Directory.Cache, data, recursive: true });
        const uri = await Filesystem.getUri({ path: WALLPAPER_FILE, directory: Directory.Cache });
        const abs = uri.uri.replace(/^file:\/\//, "");
        const r = (await SyncPlugin.setWallpaper({ path: abs, target: confRef.current.target })) as unknown as {
          ok?: boolean;
        };
        if (r?.ok) {
          active.current = true;
          applied.current = `${t.id}|${confRef.current.blur}`;
          appLog("wp", "applied", `${t.title} → ${confRef.current.target}`);
        } else {
          appLog("wp", "setWallpaper refused", JSON.stringify(r));
        }
      } catch (e) {
        appLog("wp", "apply failed", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      } finally {
        busy.current = false;
      }
    };

    const sync = () => {
      const { playing: p, target: tg } = confRef.current;
      const t = trackRef.current;
      if (tg === "off" || !p || !t) {
        void restore();
        return;
      }
      if (applied.current === `${t.id}|${confRef.current.blur}` || busy.current) return;
      void apply(t);
    };

    sync();
    const timer = setInterval(sync, 5000);
    return () => clearInterval(timer);
  }, [track, playing, target, blur]);
}
