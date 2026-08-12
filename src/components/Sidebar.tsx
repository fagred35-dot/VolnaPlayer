import { useRef, useState } from "react";
import { ACCENTS } from "../types";
import { formatTotal, plural } from "../lib/format";
import {
  IconChart,
  IconClock,
  IconDownload,
  IconFolder,
  IconHeart,
  IconHeartFilled,
  IconList,
  IconMenu,
  IconMusic,
  IconPalette,
  IconPlus,
  IconRefresh,
  IconSliders,
  IconX,
} from "./icons";

interface Props {
  open: boolean;
  onClose: () => void;
  favOnly: boolean;
  recentOpen: boolean;
  onLibrary: () => void;
  onFav: () => void;
  onRecent: () => void;
  onOpenStats: () => void;
  onAddFiles: () => void;
  onAddFolder: () => void;
  onOpenThemes: () => void;
  onOpenEq: () => void;
  onOpenTimer: () => void;
  onOpenDownload: () => void;
  onOpenCredits: () => void;
  rpcOn: boolean;
  onToggleRpc: () => void;
  count: number;
  total: number;
  timerLeft: number | null;
  accent: string;
  onAccent: (c: string) => void;
  folderName: string | null;
  folderScanning: boolean;
  onRescan: () => void;
  onOpenFolder: () => void;
  playlists: Array<{ id: string; name: string; count: number }>;
  activePlaylistId: string | null;
  onCreatePlaylist: (name: string) => void;
  onSelectPlaylist: (id: string) => void;
  onDeletePlaylist: (id: string) => void;
}

export default function Sidebar(p: Props) {
  const btn = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors";
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  /* зажатие логотипа «Волна» ~600мс → список open-source проектов */
  const pressTimer = useRef<number | null>(null);
  const startPress = () => {
    pressTimer.current = window.setTimeout(() => p.onOpenCredits(), 600);
  };
  const cancelPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
  };

  const commitCreate = () => {
    if (newName.trim()) p.onCreatePlaylist(newName.trim());
    setCreating(false);
    setNewName("");
  };

  return (
    <aside
      className={`bg-side bd-line fixed inset-y-0 left-0 z-40 flex min-h-0 w-[248px] flex-col overflow-y-auto border-r px-4 py-5 backdrop-blur-xl scroll-thin transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 lg:bg-transparent lg:backdrop-blur-none ${
        p.open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="mb-6 flex items-center gap-3 px-1">
        <button
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          onClick={p.onOpenCredits}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{ background: `linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #22d3ee))` }}
          title="Зажми — список open-source проектов"
          aria-label="О приложении"
        >
          ♪
        </button>
        <div className="flex-1">
          <div className="font-display text-base font-bold tracking-wide leading-none">ВОЛНА</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">лёгкий плеер</div>
        </div>
        <button onClick={p.onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white lg:hidden" aria-label="Закрыть меню">
          <IconX className="h-5 w-5" />
        </button>
      </div>

      <nav className="space-y-1">
        <button
          className={`${btn} ${!p.favOnly && !p.recentOpen && !p.activePlaylistId ? "bg-white/[0.07] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white"}`}
          onClick={() => {
            p.onLibrary();
            p.onClose();
          }}
        >
          <IconMusic className="h-[18px] w-[18px]" />
          Библиотека
        </button>
        <button
          className={`${btn} ${p.favOnly && !p.recentOpen ? "bg-white/[0.07] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white"}`}
          onClick={() => {
            p.onFav();
            p.onClose();
          }}
        >
          {p.favOnly ? (
            <IconHeartFilled className="h-[18px] w-[18px] text-[var(--accent)]" />
          ) : (
            <IconHeart className="h-[18px] w-[18px]" />
          )}
          Избранное
        </button>
        <button
          className={`${btn} ${p.recentOpen && !p.favOnly ? "bg-white/[0.07] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white"}`}
          onClick={() => {
            p.onRecent();
            p.onClose();
          }}
        >
          <IconClock className="h-[18px] w-[18px]" />
          Недавние
        </button>
      </nav>

      {/* Плейлисты */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">Плейлисты</span>
          <button
            onClick={() => setCreating((c) => !c)}
            className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white"
            title="Новый плейлист"
            aria-label="Новый плейлист"
          >
            <IconPlus className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
        </div>
        <div className="scroll-thin max-h-[170px] space-y-0.5 overflow-y-auto pr-1">
          {creating && (
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCreate();
                if (e.key === "Escape") {
                  setCreating(false);
                  setNewName("");
                }
              }}
              onBlur={commitCreate}
              placeholder="Название…"
              className="w-full rounded-lg border border-[var(--accent)]/60 bg-black/25 px-2.5 py-1.5 text-[13px] font-semibold text-white outline-none placeholder:text-white/25"
            />
          )}
          {p.playlists.map((pl) => {
            const active = pl.id === p.activePlaylistId;
            return (
              <div
                key={pl.id}
                className={`group flex items-center rounded-lg transition-colors ${
                  active ? "bg-white/[0.07] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <button
                  onClick={() => p.onSelectPlaylist(active ? "" : pl.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left text-[13px] font-semibold"
                >
                  <IconList className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[var(--accent)]" : ""}`} />
                  <span className="truncate">{pl.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] font-bold text-white/30">{pl.count}</span>
                </button>
                <button
                  onClick={() => p.onDeletePlaylist(pl.id)}
                  className="mr-1 hidden rounded p-1 text-white/30 transition-colors hover:text-red-400 group-hover:block"
                  aria-label="Удалить плейлист"
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          {!p.playlists.length && !creating && (
            <div className="px-2.5 py-1 text-[11px] leading-relaxed text-white/25">
              Пока пусто. Создайте плейлист и добавляйте треки через их меню
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <button
          onClick={p.onAddFiles}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #22d3ee))", boxShadow: "0 8px 24px -8px var(--accent)" }}
        >
          <IconPlus className="h-4 w-4" strokeWidth={3} />
          Добавить файлы
        </button>
        <button
          onClick={p.onAddFolder}
          className="glass flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <IconFolder className="h-4 w-4" />
          Выбрать папку с музыкой
        </button>
        <button
          onClick={p.onOpenDownload}
          className="glass flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <IconDownload className="h-4 w-4" />
          Скачать по ссылке
        </button>
      </div>

      {p.folderName && (
        <div className="glass mt-3 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <IconFolder className="h-4 w-4 shrink-0 text-[var(--accent)]" />
            <span className="truncate text-xs font-bold text-white/85">{p.folderName}</span>
            {p.folderScanning && (
              <span className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-[var(--accent)]" />
            )}
          </div>
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={p.onRescan}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/[0.07] py-1.5 text-[11px] font-bold text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white"
            >
              <IconRefresh className="h-3 w-3" />
              Синхронизация
            </button>
            <button
              onClick={p.onOpenFolder}
              className="flex-1 rounded-lg bg-white/[0.07] py-1.5 text-[11px] font-bold text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white"
            >
              В проводнике
            </button>
          </div>
        </div>
      )}

      <div className="glass sidebar-stats mt-4 rounded-2xl p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">Библиотека</div>
        <div className="mt-2 flex items-end justify-between">
          <div className="font-display text-2xl font-bold">{p.count}</div>
          <div className="pb-0.5 text-xs font-semibold text-white/45">
            {plural(p.count, ["трек", "трека", "треков"])}
          </div>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, p.total / 600)}%`, background: "var(--accent)" }} />
        </div>
        <div className="mt-1.5 text-[11px] text-white/35">{formatTotal(p.total)} звука</div>
      </div>

      <div className="flex-1" />

      <div className="space-y-2">
        <button onClick={p.onOpenStats} className={`${btn} text-white/55 hover:bg-white/[0.04] hover:text-white`}>
          <IconChart className="h-[18px] w-[18px]" />
          Статистика
        </button>
        <button onClick={p.onToggleRpc} className={`${btn} ${p.rpcOn ? "text-white/70" : "text-white/35"}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${p.rpcOn ? "bg-[#5865F2]" : "bg-white/15"}`} />
          <span className="flex-1 text-left">Discord RPC</span>
          <span className={`text-[10px] font-bold ${p.rpcOn ? "text-[#5865F2]" : "text-white/25"}`}>
            {p.rpcOn ? "вкл" : "выкл"}
          </span>
        </button>
        <button onClick={p.onOpenThemes} className={`${btn} text-white/55 hover:bg-white/[0.04] hover:text-white`}>
          <IconPalette className="h-[18px] w-[18px]" />
          Темы и стили
        </button>
        <button
          onClick={p.onOpenTimer}
          className={`${btn} ${p.timerLeft !== null ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-white/55 hover:bg-white/[0.04] hover:text-white"}`}
        >
          <IconClock className="h-[18px] w-[18px]" />
          <span className="flex-1 text-left">Таймер сна</span>
          {p.timerLeft !== null && (
            <span className="rounded-md bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {Math.ceil(p.timerLeft / 60)} мин
            </span>
          )}
        </button>
        <button onClick={p.onOpenEq} className={`${btn} text-white/55 hover:bg-white/[0.04] hover:text-white`}>
          <IconSliders className="h-[18px] w-[18px]" />
          Эквалайзер
        </button>
      </div>

      <div className="sidebar-meta mt-4 px-1">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">Акцент</div>
        <div className="flex gap-2">
          {ACCENTS.map((c) => (
            <button
              key={c}
              onClick={() => p.onAccent(c)}
              className="h-6 w-6 rounded-full transition-transform hover:scale-110 active:scale-95"
              style={{ background: c, outline: p.accent === c ? `2px solid #fff` : "none", outlineOffset: 2 }}
              aria-label={`Цвет ${c}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 hidden items-center gap-2 px-1 text-[10px] font-medium text-white/25 lg:flex">
        <IconMenu className="h-3 w-3" />
        Меню: <span className="rounded bg-white/10 px-1 py-0.5">Ctrl+K</span> поиск
      </div>
    </aside>
  );
}
