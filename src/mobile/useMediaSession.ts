import { useEffect, useRef } from "react";
import { MediaSession as CapacitorMediaSession } from "@jofr/capacitor-media-session";
import type { Track } from "../types";
import { engine } from "../engine/AudioEngine";
import { isMobilePlatform } from "../lib/platform";
import { getCoverBytes } from "../lib/covers";
import { getArt } from "../lib/art";
import { appLog } from "../lib/applog";

interface Options {
  track: Track | null;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (t: number) => void;
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
};

/**
 * Обложку отдаём плагину ТОЛЬКО как data:-URL с base64.
 * Нативный urlToBitmap качает http-ссылки синхронно в UI-потоке —
 * на Android это NetworkOnMainThreadException и крах приложения.
 * base64 плагин декодирует локально (BitmapFactory) — безопасно.
 */
async function resolveArtwork(track: Track): Promise<Array<{ src: string; sizes?: string; type?: string }>> {
  if (track.coverHash) {
    try {
      const cover = await getCoverBytes(track.coverHash);
      if (cover && cover.bytes.length) {
        appLog("art", "local cover", `${cover.bytes.length}B ${track.title}`);
        const type = cover.mime.includes("png") ? "image/png" : "image/jpeg";
        return [{ src: `data:${type};base64,${bytesToBase64(cover.bytes)}`, sizes: "512x512", type }];
      }
      appLog("art", "local cover missing/broken, trying net", track.title);
    } catch {
      /* нет обложки — попробуем сетевую */
    }
  }
  const net = await getArt(track);
  if (!net) {
    appLog("art", "no artwork", track.title);
    return [];
  }
  try {
    const res = await fetch(net);
    if (!res.ok) {
      appLog("art", "net cover http error", res.status);
      return [];
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) return [];
    appLog("art", "net cover fetched", `${bytes.length}B`);
    const type = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    return [{ src: `data:${type};base64,${bytesToBase64(bytes)}`, sizes: "600x600", type }];
  } catch (e) {
    appLog("art", "net cover fetch failed", e instanceof Error ? e.message : String(e));
    return [];
  }
}

/**
 * Фоновое воспроизведение + управление с экрана блокировки (Android).
 * Плагин @jofr/capacitor-media-session стартует foreground service, пока
 * состояние "playing", и рисует уведомление с обложкой и кнопками.
 */
export function useMediaSession({ track, playing, onPlay, onPause, onNext, onPrev, onSeek }: Options): void {
  const cb = useRef({ onPlay, onPause, onNext, onPrev, onSeek });
  cb.current = { onPlay, onPause, onNext, onPrev, onSeek };
  const trackId = track?.id ?? null;

  /* обработчики кнопок — один раз */
  useEffect(() => {
    if (!isMobilePlatform()) return;
    const M = CapacitorMediaSession;
    M.setActionHandler({ action: "play" }, () => cb.current.onPlay());
    M.setActionHandler({ action: "pause" }, () => cb.current.onPause());
    M.setActionHandler({ action: "nexttrack" }, () => cb.current.onNext());
    M.setActionHandler({ action: "previoustrack" }, () => cb.current.onPrev());
    M.setActionHandler({ action: "seekto" }, (d) => {
      if (d.seekTime != null) cb.current.onSeek(d.seekTime);
    });
    M.setActionHandler({ action: "seekbackward" }, () => {
      cb.current.onSeek(Math.max(0, engine.el.currentTime - 10));
    });
    M.setActionHandler({ action: "seekforward" }, () => {
      cb.current.onSeek(engine.el.currentTime + 10);
    });
    return () => {
      for (const action of ["play", "pause", "nexttrack", "previoustrack", "seekto", "seekbackward", "seekforward"] as const) {
        M.setActionHandler({ action }, null);
      }
      M.setPlaybackState({ playbackState: "none" });
    };
  }, []);

  /* метаданные трека */
  useEffect(() => {
    if (!isMobilePlatform()) return;
    const M = CapacitorMediaSession;
    if (!track) {
      M.setPlaybackState({ playbackState: "none" });
      return;
    }
    M.setMetadata({ title: track.title, artist: track.artist, album: track.album ?? "", artwork: [] });
    const id = track.id;
    resolveArtwork(track).then((artwork) => {
      if (id !== trackId) return;
      if (artwork.length) {
        M.setMetadata({ title: track.title, artist: track.artist, album: track.album ?? "", artwork });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  /* состояние воспроизведения */
  useEffect(() => {
    if (!isMobilePlatform()) return;
    CapacitorMediaSession.setPlaybackState({ playbackState: playing ? "playing" : "paused" });
  }, [playing, trackId]);

  /* позиция — для прогресса в уведомлении */
  useEffect(() => {
    if (!isMobilePlatform()) return;
    let last = -1;
    const onTime = () => {
      const dur = engine.el.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      const cur = Math.floor(engine.el.currentTime);
      if (cur === last) return;
      last = cur;
      CapacitorMediaSession.setPositionState({
        duration: dur,
        position: Math.min(engine.el.currentTime, dur),
        playbackRate: engine.el.playbackRate || 1,
      });
    };
    engine.el.addEventListener("timeupdate", onTime);
    return () => engine.el.removeEventListener("timeupdate", onTime);
  }, []);
}
