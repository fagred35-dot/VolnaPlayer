import { useCallback, useEffect, useRef, useState } from "react";
import type { DlMeta, DlSearchResult } from "../electron.d";

export type DlItemState = "waiting" | "downloading" | "done" | "error" | "cancelled";

export interface DlItem {
  id: number;
  url: string;
  title: string;
  channel: string;
  duration: number;
  thumb: string | null;
  /** папка назначения — показывается в карточке */
  destDir: string;
  state: DlItemState;
  percent: number;
  status: string;
  error?: string;
  path?: string;
}

interface Opts {
  getDestDir: () => string;
  /** трек скачан → добавить в библиотеку */
  onComplete: (d: { path: string; title: string; artist?: string; coverHash?: string | null }) => void;
}

/** Красивое имя из ссылки (пока не пришли метаданные) */
function nameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      const v = u.searchParams.get("v") as string;
      return `YouTube · ${v}`;
    }
    const last = u.pathname.split("/").filter(Boolean).pop() || u.hostname;
    return decodeURIComponent(last).replace(/\.[a-z0-9]{2,5}$/i, "").slice(0, 80) || u.hostname;
  } catch {
    return url.slice(0, 60);
  }
}

/**
 * Очередь скачиваний через yt-dlp.
 * Скачивает СТРОГО по одному (по очереди), живёт на уровне App —
 * поэтому очередь продолжает работать даже если окно скачивания закрыто.
 */
export function useDownloadQueue({ getDestDir, onComplete }: Opts) {
  const [items, setItems] = useState<DlItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const idSeq = useRef(1);
  const runningIdRef = useRef<number | null>(null);
  const cancelFlagRef = useRef<number | null>(null);

  const patch = useCallback((id: number, p: Partial<DlItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }, []);

  /* ---------- глобальные события yt-dlp (подписка одна на всё приложение) ---------- */
  useEffect(() => {
    if (!window.volna) return;
    const offP = window.volna.onDlProgress((p) => {
      const id = runningIdRef.current;
      if (id == null) return;
      patch(id, { percent: p.percent });
    });
    const offD = window.volna.onDlDone((d) => {
      const id = runningIdRef.current;
      runningIdRef.current = null;
      if (id == null) return;
      const item = itemsRef.current.find((i) => i.id === id);
      // если теги не прочитались — берём исполнителя из канала (поиск/метаданные)
      const artist = d.artist || item?.channel || "";
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                state: "done",
                percent: 1,
                title: d.title || i.title,
                path: d.path,
                status: "",
              }
            : i
        )
      );
      onComplete({ path: d.path, title: d.title, artist, coverHash: d.coverHash ?? null });
      // страховка: если теги не прочитались сразу (файл был занят антивирусом и т.п.),
      // перечитываем их через пару секунд и обновляем трек в библиотеке
      if (window.volna?.getTags && (!artist || !d.coverHash)) {
        setTimeout(() => {
          window.volna!
            .getTags([d.path])
            .then((tags) => {
              const tg = tags?.[d.path];
              if (tg && (tg.artist || tg.coverHash)) {
                onComplete({
                  path: d.path,
                  title: d.title,
                  artist: tg.artist || artist,
                  coverHash: tg.coverHash,
                });
              }
            })
            .catch(() => undefined);
        }, 3000);
      }
    });
    const offE = window.volna.onDlError((e) => {
      const id = runningIdRef.current;
      runningIdRef.current = null;
      if (id == null) return;
      const cancelled = cancelFlagRef.current === id;
      cancelFlagRef.current = null;
      patch(id, cancelled ? { state: "cancelled", status: "", percent: 0 } : { state: "error", status: "", error: e.message });
    });
    return () => {
      offP();
      offD();
      offE();
    };
  }, [patch, onComplete]);

  /* ---------- последовательный конвейер: качаем строго по одному ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      while (alive && window.volna) {
        if (runningIdRef.current != null) return;
        const next = itemsRef.current.find((i) => i.state === "waiting");
        if (!next) return;
        runningIdRef.current = next.id;
        patch(next.id, { state: "downloading", percent: 0, status: "", error: undefined });
        try {
          await window.volna.dlStart(next.url, next.destDir || getDestDir() || undefined);
          // событие dl-done/dl-error уже обработано и сняло runningIdRef.
          // Если по какой-то причине этого не случилось — снимаем сами, чтобы не зависнуть.
          if (alive && runningIdRef.current === next.id) {
            runningIdRef.current = null;
            patch(next.id, { state: "error", error: "No result" });
          }
        } catch (err) {
          if (!alive) return;
          if (runningIdRef.current === next.id) {
            runningIdRef.current = null;
            patch(next.id, { state: "error", error: String((err as Error)?.message || err) });
          }
        }
      }
    })();
    return () => {
      alive = false;
    };
    // конвейер перезапускается при любом изменении списка — берёт следующий «waiting»
  }, [items, patch, getDestDir]);

  /* ---------- публичные действия ---------- */

  const enqueue = useCallback(
    (partial: Pick<DlItem, "url" | "title" | "channel" | "duration" | "thumb">): boolean => {
      if (!window.volna) return false;
      const url = partial.url.trim();
      if (!url) return false;
      if (itemsRef.current.some((i) => i.url === url && i.state !== "error" && i.state !== "cancelled")) {
        return false; // уже в очереди
      }
      const id = idSeq.current++;
      const item: DlItem = {
        id,
        url,
        title: partial.title || nameFromUrl(url),
        channel: partial.channel,
        duration: partial.duration,
        thumb: partial.thumb,
        destDir: getDestDir(),
        state: "waiting",
        percent: 0,
        status: "",
      };
      setItems((prev) => [...prev, item]);
      // для сырых ссылок подтягиваем название/обложку в фоне (не блокирует очередь)
      if (!partial.title && window.volna.dlMeta) {
        window.volna
          .dlMeta(url)
          .then((meta: DlMeta | null) => {
            if (!meta) return;
            setItems((prev) =>
              prev.map((i) =>
                i.id === id && i.state === "waiting"
                  ? {
                      ...i,
                      title: meta.title || i.title,
                      channel: meta.channel || i.channel,
                      duration: meta.duration || i.duration,
                      thumb: meta.thumb ?? i.thumb,
                    }
                  : i
              )
            );
          })
          .catch(() => undefined);
      }
      return true;
    },
    [getDestDir]
  );

  const addUrl = useCallback((url: string) => enqueue({ url, title: "", channel: "", duration: 0, thumb: null }), [enqueue]);

  const addSearchResult = useCallback(
    (r: DlSearchResult) =>
      enqueue({ url: r.url, title: r.title, channel: r.channel, duration: r.duration, thumb: r.thumb }),
    [enqueue]
  );

  /** Отменить активное скачивание */
  const cancelActive = useCallback(() => {
    const id = runningIdRef.current;
    if (id == null) return;
    cancelFlagRef.current = id;
    window.volna?.dlCancel().catch(() => undefined);
  }, []);

  /** Повторить неудавшийся/отменённый элемент */
  const retry = useCallback(
    (id: number) => {
      setItems((prev) =>
        prev.map((i) => (i.id === id && (i.state === "error" || i.state === "cancelled") ? { ...i, state: "waiting", percent: 0, error: undefined } : i))
      );
    },
    []
  );

  const remove = useCallback((id: number) => {
    if (runningIdRef.current === id) return; // активный нельзя убрать — только отменить
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((i) => i.state === "waiting" || i.state === "downloading"));
  }, []);

  const busy = items.filter((i) => i.state === "downloading" || i.state === "waiting").length;

  return { items, busy, addUrl, addSearchResult, cancelActive, retry, remove, clearFinished };
}
