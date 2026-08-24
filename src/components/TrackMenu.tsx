import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Track } from "../types";
import { useI18n } from "../lib/i18n";
import {
  IconFolder,
  IconHeart,
  IconHeartFilled,
  IconList,
  IconNext,
  IconPlay,
  IconPlus,
  IconTrash,
} from "./icons";

interface Props {
  track: Track;
  x: number;
  y: number;
  playlists: Array<{ id: string; name: string }>;
  activePlaylist: { id: string; name: string } | null;
  isInActivePlaylist: boolean;
  onClose: () => void;
  onPlay: (t: Track) => void;
  onPlayNext: (t: Track) => void;
  onQueue: (t: Track) => void;
  onAddToPlaylist: (t: Track, plId: string) => void;
  onAddToActive: (t: Track) => void;
  onToggleFav: (t: Track) => void;
  onOpenExplorer: (t: Track) => void;
  onRemoveFromPlaylist: (t: Track) => void;
  onRemove: (t: Track) => void;
  onDeleteDevice: (t: Track) => void;
}

function Item({
  icon,
  label,
  danger,
  onClick,
  children,
}: {
  icon?: ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold transition-colors ${
        danger
          ? "text-red-300/80 hover:bg-red-500/10 hover:text-red-300"
          : "text-white/70 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {icon && <span className="shrink-0 opacity-80">{icon}</span>}
      <span className="truncate">{label}</span>
      {children}
    </button>
  );
}

/** Контекстное меню трека (ПКМ). Появляется у курсора, не вылезает за края окна. */
export default function TrackMenu(p: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: p.x, y: p.y });
  const [plsOpen, setPlsOpen] = useState(false);

  /* прижимаем к краям окна */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(8, Math.min(p.x, window.innerWidth - r.width - 8));
    const y = Math.max(8, Math.min(p.y, window.innerHeight - r.height - 8));
    setPos({ x, y });
  }, [p.x, p.y]);

  /* закрытие по Esc */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") p.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.onClose]);

  const tr = p.track;

  return (
    <>
      {/* клик мимо — закрыть */}
      <div className="fixed inset-0 z-[55]" onClick={p.onClose} onContextMenu={(e) => { e.preventDefault(); p.onClose(); }} />
      <div
        ref={ref}
        className="anim-in bg-panel fixed z-[60] w-60 rounded-xl border border-white/10 p-1.5 shadow-2xl backdrop-blur-xl"
        style={{ left: pos.x, top: pos.y }}
        onClick={(e) => e.stopPropagation()}
      >
        <Item icon={<IconPlay className="h-4 w-4" />} label={t("menuPlay")} onClick={() => { p.onPlay(tr); p.onClose(); }} />
        <Item
          icon={<IconNext className="h-4 w-4" />}
          label={t("playNextLabel")}
          onClick={() => { p.onPlayNext(tr); p.onClose(); }}
        />
        <Item icon={<IconPlus className="h-4 w-4" />} label={t("addToQueue")} onClick={() => { p.onQueue(tr); p.onClose(); }} />

        {/* добавить в открытый плейлист */}
        {p.activePlaylist && !p.isInActivePlaylist && (
          <Item
            icon={<IconList className="h-4 w-4 text-[var(--accent)]" />}
            label={t("menuInPlaylistName", { name: p.activePlaylist.name })}
            onClick={() => { p.onAddToActive(tr); p.onClose(); }}
          />
        )}

        <Item icon={<IconList className="h-4 w-4" />} label={t("addToPlaylist")} onClick={() => setPlsOpen((o) => !o)}>
          <span className="ml-auto text-[10px] text-white/30">▸</span>
        </Item>
        {plsOpen && (
          <div className="scroll-thin mb-1 max-h-40 overflow-y-auto rounded-lg border border-white/[0.07] bg-black/20 p-1">
            {p.playlists.length === 0 ? (
              <div className="px-2.5 py-1.5 text-[11px] text-white/30">{t("createPlaylistSidebarHint")}</div>
            ) : (
              p.playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => { p.onAddToPlaylist(tr, pl.id); p.onClose(); }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] font-semibold text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <IconList className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{pl.name}</span>
                </button>
              ))
            )}
          </div>
        )}

        {p.isInActivePlaylist && (
          <Item
            icon={<IconXSmall />}
            label={t("removeFromPlaylist")}
            onClick={() => { p.onRemoveFromPlaylist(tr); p.onClose(); }}
          />
        )}

        <div className="my-1 h-px bg-white/[0.07]" />

        <Item
          icon={tr.fav ? <IconHeartFilled className="h-4 w-4 text-[var(--accent)]" /> : <IconHeart className="h-4 w-4" />}
          label={tr.fav ? t("favRemove") : t("favAdd")}
          onClick={() => { p.onToggleFav(tr); p.onClose(); }}
        />
        {window.volna && tr.path && (
          <Item
            icon={<IconFolder className="h-4 w-4" />}
            label={t("showInExplorer")}
            onClick={() => { p.onOpenExplorer(tr); p.onClose(); }}
          />
        )}

        <div className="my-1 h-px bg-white/[0.07]" />

        <Item
          icon={<IconTrash className="h-4 w-4" />}
          label={t("removeFromLibrary")}
          danger
          onClick={() => { p.onRemove(tr); p.onClose(); }}
        />
        {window.volna && tr.path && (
          <Item
            icon={<IconTrash className="h-4 w-4" />}
            label={t("deleteFromDevice")}
            danger
            onClick={() => { p.onDeleteDevice(tr); p.onClose(); }}
          />
        )}
      </div>
    </>
  );
}

function IconXSmall() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-4 w-4">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
