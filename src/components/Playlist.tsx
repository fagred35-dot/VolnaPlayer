import { memo, useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import type { SortKey, Track } from "../types";
import { formatTime } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { IconHeart, IconHeartFilled, IconList, IconTrash, IconX } from "./icons";
import TrackCover from "./TrackCover";

interface Props {
  tracks: Track[];
  currentId: string | null;
  isPlaying: boolean;
  onPlay: (t: Track) => void;
  onFav: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onTrackMenu: (e: MouseEvent, t: Track) => void;
  onQueue: (t: Track) => void;
  /** в режиме плейлиста: убрать трек из плейлиста (свайп строки) */
  onRemoveFromPlaylist?: ((t: Track) => void) | null;
  sort: SortKey;
  sortDir: 1 | -1;
  onSort: (k: SortKey) => void;
  emptyText?: string;
}

function MiniEq({ playing, accent }: { playing: boolean; accent: string }) {
  return (
    <span className="flex h-4 items-end gap-[3px]" style={{ color: accent }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="eq-bar w-[3px] rounded-full bg-current"
          style={{
            height: playing ? "100%" : "30%",
            animationDelay: `${i * 0.18}s`,
            animationPlayState: playing ? "running" : "paused",
            opacity: playing ? 1 : 0.45,
          }}
        />
      ))}
    </span>
  );
}

interface RowProps {
  tr: Track;
  i: number;
  active: boolean;
  isPlaying: boolean;
  sortable: boolean;
  cols: string;
  dragging: boolean;
  over: boolean;
  onPlay: (t: Track) => void;
  onFav: (id: string) => void;
  onRemove: (id: string) => void;
  onTrackMenu: (e: MouseEvent, t: Track) => void;
  onQueue: (t: Track) => void;
  onRemoveFromPlaylist: ((t: Track) => void) | null;
  onDragStart: (i: number) => void;
  onDragEnd: () => void;
  onDragOver: (i: number) => void;
  onDrop: (i: number) => void;
}

const SWIPE_PX = 128; // две кнопки по 64px
const SWIPE_OPEN_THRESHOLD = 56;

const Row = memo(function Row(p: RowProps) {
  const { t } = useI18n();
  const tr = p.tr;
  const [swipe, setSwipe] = useState(0);
  const touch = useRef<{ x: number; y: number; base: number } | null>(null);
  const swipeRef = useRef(0);
  swipeRef.current = swipe;

  const onTouchStart = (e: React.TouchEvent) => {
    const th = e.touches[0];
    touch.current = { x: th.clientX, y: th.clientY, base: swipeRef.current };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const th = e.touches[0];
    const dx = th.clientX - touch.current.x;
    const dy = th.clientY - touch.current.y;
    // горизонтальный жест — не мешаем вертикальному скроллу
    if (Math.abs(dx) <= Math.abs(dy)) return;
    setSwipe(Math.max(-SWIPE_PX, Math.min(0, touch.current.base + dx)));
  };
  const onTouchEnd = () => {
    touch.current = null;
    setSwipe((cur) => (cur < -SWIPE_OPEN_THRESHOLD ? -SWIPE_PX : 0));
  };

  const onClick = () => {
    // открытая свайпом строка: первый тап закрывает, а не играет
    if (swipeRef.current !== 0) {
      setSwipe(0);
      return;
    }
    p.onPlay(tr);
  };

  const actBtn = "flex h-full w-16 items-center justify-center transition-colors active:scale-95";

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ touchAction: "pan-y" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* действия за строкой (свайп влево) */}
      <div
        className="absolute inset-y-0 right-0 flex"
        style={{ opacity: swipe < 0 ? Math.min(1, -swipe / SWIPE_OPEN_THRESHOLD) : 0 }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            p.onFav(tr.id);
            setSwipe(0);
          }}
          className={`${actBtn} ${tr.fav ? "bg-[var(--accent)]/20 text-[var(--accent)]" : "bg-white/[0.07] text-white/60"}`}
          aria-label={t("favAdd")}
        >
          {tr.fav ? <IconHeartFilled className="h-5 w-5" /> : <IconHeart className="h-5 w-5" />}
        </button>
        {p.onRemoveFromPlaylist ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              p.onRemoveFromPlaylist!(tr);
              setSwipe(0);
            }}
            className={`${actBtn} bg-amber-500/15 text-amber-300`}
            aria-label={t("removeFromPlaylist")}
          >
            <IconX className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              p.onQueue(tr);
              setSwipe(0);
            }}
            className={`${actBtn} bg-white/[0.07] text-white/60`}
            aria-label={t("addToQueue")}
          >
            <IconList className="h-5 w-5" />
          </button>
        )}
      </div>

      <div
        draggable={p.sortable}
        onDragStart={() => p.onDragStart(p.i)}
        onDragEnd={p.onDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          p.onDragOver(p.i);
        }}
        onDrop={(e) => {
          e.preventDefault();
          p.onDrop(p.i);
        }}
        onClick={onClick}
        onContextMenu={(e) => p.onTrackMenu(e, tr)}
        data-tid={tr.id}
        className={`group ${p.cols} cursor-pointer items-center rounded-xl px-3 py-2 transition-[colors,transform] ${
          p.active ? "bg-white/[0.07]" : "hover:bg-white/[0.045]"
        } ${p.dragging ? "opacity-40" : ""} ${p.over ? "shadow-[inset_0_2px_0_0_var(--accent)]" : ""}`}
        style={{
          transform: swipe ? `translateX(${swipe}px)` : undefined,
          transition: touch.current ? "none" : "transform .18s ease",
        }}
      >
        <div className="flex items-center justify-center">
          {p.active ? (
            <MiniEq playing={p.isPlaying} accent="var(--accent)" />
          ) : (
            <span className="text-xs font-bold tabular-nums text-white/30">{p.i + 1}</span>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <TrackCover track={tr} className="h-9 w-9 rounded-lg text-sm sm:h-10 sm:w-10" iconClassName="text-white/90" />
          <div className="min-w-0">
            <div className={`truncate text-sm font-semibold ${p.active ? "text-[var(--accent)]" : "text-white/90"}`}>
              {tr.title || tr.fileName}
            </div>
            <div className="truncate text-xs text-white/40">
              {tr.artist || t("unknownArtist")}
              {tr.album ? ` · ${tr.album}` : ""}
            </div>
          </div>
        </div>

        <div className="artist-col hidden truncate text-sm text-white/50 lg:block">{tr.artist || "—"}</div>

        <div className="relative flex items-center justify-end">
          {/* время — фиксированной ширины у правого края, ровно под заголовком */}
          <span className="w-12 text-right text-[11px] tabular-nums text-white/40 sm:w-14 sm:text-xs">
            {tr.duration > 0 ? formatTime(tr.duration) : "—:——"}
          </span>
          {/* кнопки появляются поверх времени при наведении */}
          <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 rounded-lg bg-[#12151d]/95 pl-1 opacity-0 shadow-lg backdrop-blur-sm transition-opacity group-hover:opacity-100 sm:gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                p.onFav(tr.id);
              }}
              className={`rounded-lg p-1.5 transition-all hover:scale-110 ${
                tr.fav ? "text-[var(--accent)]" : "text-white/25 hover:text-white/70"
              }`}
              aria-label={t("favAdd")}
            >
              {tr.fav ? <IconHeartFilled className="h-4 w-4" /> : <IconHeart className="h-4 w-4" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                p.onRemove(tr.id);
              }}
              className="rounded-lg p-1.5 text-white/25 transition-all hover:scale-110 hover:text-red-400"
              aria-label={t("remove")}
            >
              <IconTrash className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function Playlist(p: Props) {
  const { t } = useI18n();
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* автопрокрутка к играющему треку */
  useEffect(() => {
    if (!p.currentId) return;
    const el = scrollRef.current?.querySelector(`[data-tid="${p.currentId}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [p.currentId]);

  const sortable = p.sort === "order";
  const header =
    "cursor-pointer select-none text-[11px] font-bold uppercase tracking-[0.14em] text-white/35 transition-colors hover:text-white/70";

  const sortArrow = (k: SortKey) => (p.sort === k ? (p.sortDir === 1 ? " ↑" : " ↓") : "");
  const cols = "grid grid-cols-[36px_1fr_56px] gap-2 sm:grid-cols-[40px_1fr_68px] sm:gap-3 lg:grid-cols-[44px_1fr_1fr_68px]";

  const onReorderRef = useRef(p.onReorder);
  onReorderRef.current = p.onReorder;

  const handleDragStart = useCallback((i: number) => {
    dragIdxRef.current = i;
    setDragIdx(i);
  }, []);
  const handleDragEnd = useCallback(() => {
    dragIdxRef.current = null;
    setDragIdx(null);
    setOverIdx(null);
  }, []);
  const handleDragOver = useCallback((i: number) => {
    setOverIdx((cur) => (cur === i ? cur : i));
  }, []);
  const handleDrop = useCallback((i: number) => {
    const from = dragIdxRef.current;
    dragIdxRef.current = null;
    setDragIdx(null);
    setOverIdx(null);
    if (from !== null && from !== i) onReorderRef.current(from, i);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className={`${cols} border-b border-white/[0.06] px-5 pb-2`}>
        <div className="text-center text-[11px] font-bold uppercase tracking-[0.14em] text-white/25">#</div>
        <button className={`${header} text-left`} onClick={() => p.onSort("title")}>
          {t("colTitle")}
          {sortArrow("title")}
        </button>
        <button className={`${header} hidden text-left lg:block`} onClick={() => p.onSort("artist")}>
          {t("colArtist")}
          {sortArrow("artist")}
        </button>
        <button className={`${header} text-right`} onClick={() => p.onSort("duration")}>
          <span className="hidden sm:inline">{t("colTime")}</span>
          <span className="sm:hidden">⌛</span>
          {sortArrow("duration")}
        </button>
      </div>

      <div ref={scrollRef} className="scroll-thin flex-1 overflow-y-auto px-2 py-2">
        {p.tracks.map((tr, i) => (
          <Row
            key={tr.id}
            tr={tr}
            i={i}
            active={tr.id === p.currentId}
            isPlaying={p.isPlaying}
            sortable={sortable}
            cols={cols}
            dragging={dragIdx === i}
            over={overIdx === i && dragIdx !== null && dragIdx !== i}
            onPlay={p.onPlay}
            onFav={p.onFav}
            onRemove={p.onRemove}
            onTrackMenu={p.onTrackMenu}
            onQueue={p.onQueue}
            onRemoveFromPlaylist={p.onRemoveFromPlaylist ?? null}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
        {!p.tracks.length && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
            <div className="text-4xl">🔍</div>
            <div className="text-sm font-semibold text-white/50">{p.emptyText ?? t("nothingFound")}</div>
            <div className="text-xs text-white/30">{t("nothingFoundHint")}</div>
          </div>
        )}
      </div>
    </div>
  );
}
