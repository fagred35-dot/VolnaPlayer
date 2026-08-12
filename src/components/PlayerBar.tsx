import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { RepeatMode, Track } from "../types";
import { formatTime } from "../lib/format";
import {
  IconClock,
  IconDisc,
  IconFolder,
  IconHeart,
  IconHeartFilled,
  IconList,
  IconMini,
  IconMute,
  IconNext,
  IconPause,
  IconPlay,
  IconPlus,
  IconPrev,
  IconRepeat,
  IconRepeatOne,
  IconShuffle,
  IconSliders,
  IconTrash,
  IconVolume,
  IconX,
} from "./icons";
import SeekBar from "./SeekBar";
import TrackCover from "./TrackCover";

interface Props {
  track: Track | null;
  isPlaying: boolean;
  time: number;
  duration: number;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (v: number) => void;
  volume: number;
  muted: boolean;
  onVolume: (v: number) => void;
  onMute: () => void;
  speed: number;
  onSpeed: () => void;
  repeat: RepeatMode;
  onRepeat: () => void;
  shuffle: boolean;
  onShuffle: () => void;
  onOpenNow: () => void;
  onOpenEq: () => void;
  onOpenTimer: () => void;
  /** громкость текущего трека (0..1) */
  gain: number;
  onGain: (v: number) => void;
  onOpenExplorer: (t: Track) => void;
  onRemoveTrack: (t: Track) => void;
  onOpenMini: () => void;
  /** очередь */
  queueCount: number;
  onOpenQueue: () => void;
  onQueueTrack: () => void;
  /** плейлисты */
  playlists: Array<{ id: string; name: string }>;
  onAddToPlaylist: (plId: string) => void;
  onRemoveFromPlaylist: (() => void) | null;
  timerLeft: number | null;
  eqOn: boolean;
  onFav: (id: string) => void;
}

const ctrlBtn =
  "rounded-xl p-2 text-white/60 transition-all hover:bg-white/[0.07] hover:text-white active:scale-90";

const gainPresetBtn =
  "flex-1 rounded-lg bg-white/[0.07] py-1.5 text-[11px] font-bold text-white/60 transition-colors hover:bg-white/[0.14] hover:text-white active:scale-95";

export default function PlayerBar(p: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [plsOpen, setPlsOpen] = useState(false);
  const [volHover, setVolHover] = useState(false);
  const volTimer = useRef<number | null>(null);
  useEffect(() => {
    setMenuOpen(false);
    setPlsOpen(false);
  }, [p.track?.id]);

  /* попап громкости держится 3с после ухода мыши — успеваем перевести курсор */
  const showVol = () => {
    if (volTimer.current) window.clearTimeout(volTimer.current);
    setVolHover(true);
  };
  const hideVol = () => {
    if (volTimer.current) window.clearTimeout(volTimer.current);
    volTimer.current = window.setTimeout(() => setVolHover(false), 3000);
  };

  const vol = p.muted ? 0 : p.volume;
  const volPct = Math.round(vol * 100);
  const gainPct = Math.round(p.gain * 100);
  const t = p.track;

  const lowerGain = (delta: number) => p.onGain(Math.max(0, p.gain - delta));

  return (
    <footer
      className="player-bar bd-line col-start-1 row-start-2 flex max-h-[104px] shrink-0 items-center gap-2 border-t px-3 py-2.5 backdrop-blur-2xl sm:gap-4 sm:px-5 sm:py-3 lg:col-end-3"
      style={{ background: "color-mix(in srgb, var(--bg-base) 50%, transparent)" }}
    >
      {/* Трек — клик по названию открывает меню трека */}
      <div className="relative flex w-[min(30vw,280px)] min-w-0 shrink-0 items-center gap-2 sm:w-[280px] sm:gap-3">
        <button
          onClick={() => p.track && setMenuOpen((o) => !o)}
          disabled={!p.track}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 text-left transition-colors hover:bg-white/[0.05] disabled:cursor-default disabled:hover:bg-transparent sm:gap-3"
          title="Меню трека"
        >
          <TrackCover
            track={t ?? FALLBACK}
            className="h-10 w-10 rounded-xl text-base sm:h-11 sm:w-11 sm:text-lg"
            iconClassName="text-white/90"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-white sm:text-sm">
              {t ? t.title : "Нет трека"}
            </div>
            <div className="hidden truncate text-xs text-white/40 sm:block">
              {t ? t.artist || "Неизвестный исполнитель" : "Добавьте музыку"}
            </div>
          </div>
        </button>
        <button
          onClick={() => t && p.onFav(t.id)}
          className={`hidden rounded-lg p-1.5 transition-all hover:scale-110 sm:block ${
            t?.fav ? "text-[var(--accent)]" : "text-white/30 hover:text-white"
          }`}
          aria-label="В избранное"
        >
          {t?.fav ? <IconHeartFilled className="h-4 w-4" /> : <IconHeart className="h-4 w-4" />}
        </button>

        {/* ======= МЕНЮ ТРЕКА ======= */}
        {menuOpen && t && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div
              className="bg-panel absolute bottom-full left-0 z-50 mb-2 w-[300px] rounded-2xl border border-white/10 p-3 shadow-2xl backdrop-blur-xl"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <TrackCover track={t} className="h-12 w-12 rounded-xl text-lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-white">{t.title}</div>
                  <div className="truncate text-xs text-white/40">
                    {t.artist || "Неизвестный исполнитель"}
                    {t.album ? ` · ${t.album}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => p.onFav(t.id)}
                  className={`rounded-lg p-2 transition-all hover:scale-110 ${
                    t.fav ? "text-[var(--accent)]" : "text-white/30 hover:text-white"
                  }`}
                  aria-label="В избранное"
                >
                  {t.fav ? <IconHeartFilled className="h-4.5 w-4.5" /> : <IconHeart className="h-4.5 w-4.5" />}
                </button>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-white/40">
                  <span>Громкость трека</span>
                  <span className="text-[var(--accent)]">{gainPct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={gainPct}
                  onChange={(e) => p.onGain(Number(e.target.value) / 100)}
                  className="modal-slider mt-1.5"
                  style={{ "--fill": `${gainPct}%` } as CSSProperties}
                  aria-label="Громкость трека"
                />
                <div className="mt-1.5 flex gap-1.5">
                  <button onClick={() => lowerGain(0.3)} className={gainPresetBtn} title="Тише на 30%">
                    −30%
                  </button>
                  <button onClick={() => lowerGain(0.5)} className={gainPresetBtn} title="Тише на 50%">
                    −50%
                  </button>
                  <button onClick={() => p.onGain(1)} className={gainPresetBtn} title="Стандартная громкость">
                    100%
                  </button>
                </div>
              </div>

              <div className="my-2 h-px bg-white/[0.07]" />

              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    p.onOpenNow();
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <IconDisc className="h-4 w-4" />
                  Сейчас играет
                </button>
                <button
                  onClick={() => {
                    p.onQueueTrack();
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <IconPlus className="h-4 w-4" />
                  В очередь
                </button>
                <button
                  onClick={() => setPlsOpen((o) => !o)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <IconList className="h-4 w-4" />
                  В плейлист
                  <span className="ml-auto text-[10px] text-white/30">▸</span>
                </button>
                {plsOpen && (
                  <div className="scroll-thin ml-5 max-h-36 space-y-0.5 overflow-y-auto border-l border-white/10 pl-2">
                    {p.playlists.map((pl) => (
                      <button
                        key={pl.id}
                        onClick={() => {
                          p.onAddToPlaylist(pl.id);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
                      >
                        <IconList className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{pl.name}</span>
                      </button>
                    ))}
                    {!p.playlists.length && (
                      <div className="px-2 py-1 text-[11px] leading-relaxed text-white/30">
                        Создайте плейлист в боковом меню
                      </div>
                    )}
                  </div>
                )}
                {p.onRemoveFromPlaylist && (
                  <button
                    onClick={() => {
                      p.onRemoveFromPlaylist!();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-semibold text-amber-300/80 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
                  >
                    <IconX className="h-4 w-4" />
                    Убрать из плейлиста
                  </button>
                )}
                {window.volna && t.path && (
                  <button
                    onClick={() => {
                      p.onOpenExplorer(t);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    <IconFolder className="h-4 w-4" />
                    Открыть в проводнике
                  </button>
                )}
                <button
                  onClick={() => {
                    p.onRemoveTrack(t);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-semibold text-red-300/80 transition-colors hover:bg-red-500/10 hover:text-red-300"
                >
                  <IconTrash className="h-4 w-4" />
                  Удалить из библиотеки
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Центр */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={p.onShuffle} className={`${ctrlBtn} hidden sm:block ${p.shuffle ? "text-[var(--accent)]" : ""}`} aria-label="Перемешать">
            <IconShuffle className="h-[18px] w-[18px]" />
          </button>
          <button onClick={p.onPrev} className={ctrlBtn} aria-label="Предыдущий">
            <IconPrev className="h-5 w-5" />
          </button>
          <button
            onClick={p.onToggle}
            disabled={!p.track}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 sm:h-11 sm:w-11"
            style={{
              background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #22d3ee))",
              boxShadow: "0 6px 22px -6px var(--accent)",
            }}
            aria-label="Играть / Пауза"
          >
            {p.isPlaying ? <IconPause className="h-5 w-5" /> : <IconPlay className="h-5 w-5" />}
          </button>
          <button onClick={p.onNext} className={ctrlBtn} aria-label="Следующий">
            <IconNext className="h-5 w-5" />
          </button>
          <button
            onClick={p.onRepeat}
            className={`${ctrlBtn} hidden sm:block ${p.repeat !== "off" ? "text-[var(--accent)]" : ""}`}
            aria-label="Повтор"
          >
            {p.repeat === "one" ? <IconRepeatOne className="h-[18px] w-[18px]" /> : <IconRepeat className="h-[18px] w-[18px]" />}
          </button>
        </div>
        <div className="flex w-full max-w-[640px] items-center gap-2 sm:gap-3">
          <span className="w-9 text-right text-[10px] font-semibold tabular-nums text-white/40 sm:w-11 sm:text-[11px]">
            {formatTime(p.time)}
          </span>
          <SeekBar value={p.duration > 0 ? p.time / p.duration : 0} onChange={p.onSeek} />
          <span className="w-9 text-[10px] font-semibold tabular-nums text-white/40 sm:w-11 sm:text-[11px]">
            -{formatTime(Math.max(0, p.duration - p.time))}
          </span>
        </div>
      </div>

      {/* Право */}
      <div className="flex w-[min(30vw,280px)] shrink-0 items-center justify-end gap-0.5 sm:w-auto sm:gap-1 lg:w-[280px]">
        <button onClick={p.onSpeed} className={`${ctrlBtn} hidden text-xs font-extrabold tracking-wide lg:block`} title="Скорость">
          {p.speed}×
        </button>

        {/* Мини-плеер */}
        <button
          onClick={p.onOpenMini}
          className={`${ctrlBtn} ${window.volna ? "" : "opacity-40"}`}
          title={window.volna ? "Мини-плеер" : "Мини-плеер доступен в Windows-приложении"}
          aria-label="Мини-плеер"
        >
          <IconMini className="h-[18px] w-[18px]" />
        </button>

        {/* Очередь */}
        <button
          onClick={p.onOpenQueue}
          className={`${ctrlBtn} relative hidden sm:block ${p.queueCount > 0 ? "text-[var(--accent)]" : ""}`}
          aria-label="Очередь"
          title="Очередь"
        >
          <IconList className="h-[18px] w-[18px]" />
          {p.queueCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-extrabold text-white">
              {p.queueCount}
            </span>
          )}
        </button>

        {/* ======= ВЕРТИКАЛЬНАЯ ГРОМКОСТЬ (при наведении) ======= */}
        <div
          className="relative flex items-center"
          onMouseEnter={showVol}
          onMouseLeave={hideVol}
        >
          <button onClick={p.onMute} className={ctrlBtn} aria-label="Без звука" title="Без звука">
            {p.muted || p.volume === 0 ? <IconMute className="h-[18px] w-[18px]" /> : <IconVolume className="h-[18px] w-[18px]" />}
          </button>
          {volHover && (
            <div
              className="bg-panel absolute bottom-full right-0 z-50 mb-2 rounded-2xl border border-white/10 p-3 shadow-2xl backdrop-blur-xl"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-end gap-3">
                {/* общая громкость */}
                <div className="flex w-9 flex-col items-center gap-1.5">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volPct}
                    onChange={(e) => p.onVolume(Number(e.target.value) / 100)}
                    className="vslider"
                    style={{ height: 130 } as CSSProperties}
                    aria-label="Общая громкость"
                  />
                  <span className="text-[9px] font-bold leading-none text-white/40">Общая</span>
                  <span className="text-[10px] font-bold leading-none text-[var(--accent)]">{volPct}%</span>
                </div>
                <div className="h-[130px] w-px bg-white/10" />
                {/* громкость трека */}
                <div className="flex w-9 flex-col items-center gap-1.5">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={gainPct}
                    onChange={(e) => p.onGain(Number(e.target.value) / 100)}
                    className="vslider"
                    style={{ height: 130 } as CSSProperties}
                    aria-label="Громкость трека"
                  />
                  <span className="text-[9px] font-bold leading-none text-white/40">Трек</span>
                  <span className={`text-[10px] font-bold leading-none ${p.gain !== 1 ? "text-[var(--accent)]" : "text-white/40"}`}>
                    {gainPct}%
                  </span>
                </div>
              </div>
              {p.gain !== 1 && (
                <button
                  onClick={() => p.onGain(1)}
                  className="mt-2 w-full rounded-lg bg-white/[0.07] py-1 text-[10px] font-bold text-white/50 transition-colors hover:bg-white/[0.14] hover:text-white"
                >
                  Сбросить трек: 100%
                </button>
              )}
              <div className="mt-2 flex justify-between gap-1">
                <button onClick={() => lowerGain(0.3)} className="flex-1 rounded-lg bg-white/[0.07] py-1 text-[10px] font-bold text-white/50 transition-colors hover:text-white">
                  −30%
                </button>
                <button onClick={() => lowerGain(0.5)} className="flex-1 rounded-lg bg-white/[0.07] py-1 text-[10px] font-bold text-white/50 transition-colors hover:text-white">
                  −50%
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
        <button onClick={p.onOpenEq} className={`${ctrlBtn} hidden md:block ${p.eqOn ? "text-[var(--accent)]" : ""}`} aria-label="Эквалайзер">
          <IconSliders className="h-[18px] w-[18px]" />
        </button>
        <button onClick={p.onOpenTimer} className={`${ctrlBtn} hidden md:block ${p.timerLeft !== null ? "text-[var(--accent)]" : ""}`} aria-label="Таймер сна">
          <IconClock className="h-[18px] w-[18px]" />
        </button>
        <button onClick={p.onOpenNow} className={ctrlBtn} aria-label="Во весь экран">
          <IconNext className="h-4 w-4 rotate-[-90deg]" />
        </button>
      </div>
    </footer>
  );
}

const FALLBACK: Track = {
  id: "__none__",
  title: "",
  artist: "",
  duration: 0,
  addedAt: 0,
  fav: false,
  fileName: "",
  fileSize: 0,
};
