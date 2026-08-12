import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { SortKey, Track } from "../types";
import { formatTime } from "../lib/format";
import { IconHeart, IconHeartFilled, IconTrash } from "./icons";
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

export default function Playlist(p: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
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

  return (
    <div className="flex h-full flex-col">
      <div className={`${cols} border-b border-white/[0.06] px-5 pb-2`}>
        <div className="text-center text-[11px] font-bold uppercase tracking-[0.14em] text-white/25">#</div>
        <button className={`${header} text-left`} onClick={() => p.onSort("title")}>
          Название{sortArrow("title")}
        </button>
        <button className={`${header} hidden text-left lg:block`} onClick={() => p.onSort("artist")}>
          Исполнитель{sortArrow("artist")}
        </button>
        <button className={`${header} text-right`} onClick={() => p.onSort("duration")}>
          <span className="hidden sm:inline">Время</span>
          <span className="sm:hidden">⌛</span>
          {sortArrow("duration")}
        </button>
      </div>

      <div ref={scrollRef} className="scroll-thin flex-1 overflow-y-auto px-2 py-2">
        {p.tracks.map((t, i) => {
          const active = t.id === p.currentId;
          const dragging = dragIdx === i;
          const over = overIdx === i && dragIdx !== null && dragIdx !== i;
          return (
            <div
              key={t.id}
              draggable={sortable}
              onDragStart={() => setDragIdx(i)}
              onDragEnd={() => {
                setDragIdx(null);
                setOverIdx(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragIdx !== null) setOverIdx(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== i) p.onReorder(dragIdx, i);
                setDragIdx(null);
                setOverIdx(null);
              }}
              onClick={() => p.onPlay(t)}
              onContextMenu={(e) => p.onTrackMenu(e, t)}
              data-tid={t.id}
              className={`group ${cols} cursor-pointer items-center rounded-xl px-3 py-2 transition-colors ${
                active ? "bg-white/[0.07]" : "hover:bg-white/[0.045]"
              } ${dragging ? "opacity-40" : ""} ${over ? "shadow-[inset_0_2px_0_0_var(--accent)]" : ""}`}
            >
              <div className="flex items-center justify-center">
                {active ? (
                  <MiniEq playing={p.isPlaying} accent="var(--accent)" />
                ) : (
                  <span className="text-xs font-bold tabular-nums text-white/30">{i + 1}</span>
                )}
              </div>

              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <TrackCover track={t} className="h-9 w-9 rounded-lg text-sm sm:h-10 sm:w-10" iconClassName="text-white/90" />
                <div className="min-w-0">
                  <div className={`truncate text-sm font-semibold ${active ? "text-[var(--accent)]" : "text-white/90"}`}>
                    {t.title || t.fileName}
                  </div>
                  <div className="truncate text-xs text-white/40">
                    {t.artist || "Неизвестный исполнитель"}
                    {t.album ? ` · ${t.album}` : ""}
                  </div>
                </div>
              </div>

              <div className="artist-col hidden truncate text-sm text-white/50 lg:block">{t.artist || "—"}</div>

              <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                <span className="mr-1 text-[11px] tabular-nums text-white/40 sm:text-xs">
                  {t.duration > 0 ? formatTime(t.duration) : "—:——"}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    p.onFav(t.id);
                  }}
                  className={`rounded-lg p-1.5 transition-all hover:scale-110 ${
                    t.fav ? "text-[var(--accent)]" : "text-white/25 opacity-0 hover:text-white/70 group-hover:opacity-100"
                  }`}
                  aria-label="В избранное"
                >
                  {t.fav ? <IconHeartFilled className="h-4 w-4" /> : <IconHeart className="h-4 w-4" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    p.onRemove(t.id);
                  }}
                  className="rounded-lg p-1.5 text-white/25 opacity-0 transition-all hover:scale-110 hover:text-red-400 group-hover:opacity-100"
                  aria-label="Удалить"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
        {!p.tracks.length && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
            <div className="text-4xl">🔍</div>
            <div className="text-sm font-semibold text-white/50">{p.emptyText ?? "Ничего не найдено"}</div>
            <div className="text-xs text-white/30">Попробуйте другой запрос или сбросьте фильтры</div>
          </div>
        )}
      </div>
    </div>
  );
}
