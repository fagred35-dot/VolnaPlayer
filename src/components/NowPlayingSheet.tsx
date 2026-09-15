import { useEffect, useRef, useState } from "react";
import type { RepeatMode, Track } from "../types";
import { formatTime } from "../lib/format";
import { useI18n } from "../lib/i18n";
import {
  IconHeart,
  IconHeartFilled,
  IconList,
  IconNext,
  IconPrev,
  IconPause,
  IconPlay,
  IconRepeat,
  IconRepeatOne,
  IconShuffle,
  IconX,
} from "./icons";
import SeekBar from "./SeekBar";
import TrackCover from "./TrackCover";

interface Props {
  track: Track;
  isPlaying: boolean;
  time: number;
  duration: number;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (v: number) => void;
  onFav: (id: string) => void;
  shuffle: boolean;
  onShuffle: () => void;
  repeat: RepeatMode;
  onRepeat: () => void;
  queueCount: number;
  onOpenQueue: () => void;
  onClose: () => void;
}

const SWIPE_CLOSE_PX = 110;

/**
 * «Сейчас играет» — полноэкранная нижняя шторка для тача:
 * большая обложка, таймлайн, управление. Свайп вниз — закрыть.
 */
export default function NowPlayingSheet(p: Props) {
  const { t } = useI18n();
  const [dragY, setDragY] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);

  /* блокируем прокрутку фона, пока шторка открыта */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    const th = e.touches[0];
    touch.current = { x: th.clientX, y: th.clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const th = e.touches[0];
    const dy = th.clientY - touch.current.y;
    const dx = th.clientX - touch.current.x;
    // тянем вниз только если жест явно вертикальный
    if (dy > 0 && dy > Math.abs(dx)) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > SWIPE_CLOSE_PX) p.onClose();
    setDragY(0);
    touch.current = null;
  };

  return (
    <div className="fixed inset-0 z-[70] sm:hidden" role="dialog" aria-label={t("nowPlaying")}>
      <div
        className="volna-fade absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={p.onClose}
        onTouchEnd={onTouchEnd}
      />
      <div
        className="volna-sheet bg-panel absolute inset-x-0 bottom-0 flex max-h-[92%] flex-col rounded-t-3xl border-t border-white/10 shadow-2xl backdrop-blur-2xl"
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY ? "none" : "transform .22s ease",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* ручка свайпа */}
        <div className="flex shrink-0 items-center justify-between px-4 pt-3">
          <span className="w-9" />
          <span className="h-1.5 w-12 rounded-full bg-white/15" />
          <button
            onClick={p.onClose}
            className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label={t("close")}
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        {/* обложка */}
        <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-4">
          <TrackCover
            track={p.track}
            className="aspect-square h-auto max-h-full w-full max-w-[320px] rounded-3xl text-7xl shadow-2xl"
            iconClassName="text-white/90"
          />
        </div>

        {/* название — только обрезка, без растягивания */}
        <div className="min-w-0 px-6 text-center">
          <div className="truncate text-lg font-bold text-white">{p.track.title || p.track.fileName}</div>
          <div className="mt-0.5 truncate text-sm text-white/45">{p.track.artist || t("unknownArtist")}</div>
        </div>

        {/* таймлайн */}
        <div className="mt-4 flex w-full items-center gap-2 px-6">
          <span className="w-9 shrink-0 text-right text-[10px] font-semibold tabular-nums text-white/40">
            {formatTime(p.time)}
          </span>
          <div className="min-w-0 flex-1">
            <SeekBar value={p.duration > 0 ? p.time / p.duration : 0} onChange={p.onSeek} />
          </div>
          <span className="w-9 shrink-0 text-[10px] font-semibold tabular-nums text-white/40">
            -{formatTime(Math.max(0, p.duration - p.time))}
          </span>
        </div>

        {/* управление */}
        <div className="flex items-center justify-center gap-3 px-6 pb-2 pt-3">
          <button
            onClick={p.onShuffle}
            className={`rounded-xl p-2.5 transition-all active:scale-90 ${p.shuffle ? "text-[var(--accent)]" : "text-white/40"}`}
            aria-label={t("shuffleShort")}
          >
            <IconShuffle className="h-5 w-5" />
          </button>
          <button onClick={p.onPrev} className="rounded-xl p-2.5 text-white/70 transition-all active:scale-90" aria-label={t("prevTrack")}>
            <IconPrev className="h-6 w-6" />
          </button>
          <button
            onClick={p.onToggle}
            className="flex h-16 w-16 items-center justify-center rounded-full text-white transition-all hover:scale-105 active:scale-95"
            style={{ background: "var(--accent-grad)", boxShadow: "0 8px 28px -6px var(--accent)" }}
            aria-label={t("playPause")}
          >
            {p.isPlaying ? <IconPause className="h-7 w-7" /> : <IconPlay className="h-7 w-7" />}
          </button>
          <button onClick={p.onNext} className="rounded-xl p-2.5 text-white/70 transition-all active:scale-90" aria-label={t("nextTrack")}>
            <IconNext className="h-6 w-6" />
          </button>
          <button
            onClick={p.onRepeat}
            className={`rounded-xl p-2.5 transition-all active:scale-90 ${p.repeat !== "off" ? "text-[var(--accent)]" : "text-white/40"}`}
            aria-label={t("repeatShort")}
          >
            {p.repeat === "one" ? <IconRepeatOne className="h-5 w-5" /> : <IconRepeat className="h-5 w-5" />}
          </button>
        </div>

        {/* избранное + очередь */}
        <div className="flex items-center justify-between px-8 pb-[calc(1.2rem+env(safe-area-inset-bottom))] pt-1">
          <button
            onClick={() => p.onFav(p.track.id)}
            className={`rounded-xl p-2 transition-all active:scale-90 ${p.track.fav ? "text-[var(--accent)]" : "text-white/35"}`}
            aria-label={t("favAdd")}
          >
            {p.track.fav ? <IconHeartFilled className="h-5 w-5" /> : <IconHeart className="h-5 w-5" />}
          </button>
          <button
            onClick={p.onOpenQueue}
            className="relative rounded-xl p-2 text-white/50 transition-all active:scale-90"
            aria-label={t("queueBtn")}
          >
            <IconList className="h-5 w-5" />
            {p.queueCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-extrabold text-white">
                {p.queueCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
