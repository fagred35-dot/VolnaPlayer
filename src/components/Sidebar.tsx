import { useRef, useState } from "react";
import { formatTotal } from "../lib/format";
import { countText, useI18n } from "../lib/i18n";
import {
  IconClock,
  IconDownload,
  IconFolder,
  IconHeart,
  IconHeartFilled,
  IconList,
  IconMenu,
  IconMusic,
  IconPlus,
  IconRefresh,
  IconSettings,
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
  onOpenDownload: () => void;
  onOpenCredits: () => void;
  onOpenSettings: () => void;
  count: number;
  total: number;
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
  const { t, lang } = useI18n();
  const btn = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors";
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState("");
  /* зажатие логотипа «Волна» ~600мс → список open-source проектов */
  const pressTimer = useRef<number | null>(null);
  const firedRef = useRef(false);
  const startPress = () => {
    firedRef.current = false;
    pressTimer.current = window.setTimeout(() => {
      firedRef.current = true;
      p.onOpenCredits();
    }, 600);
  };
  const cancelPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
  };

  /* запрет плейлистов с одинаковыми именами (без учёта регистра) */
  const commitCreate = () => {
    const name = newName.trim();
    if (!name) {
      setCreating(false);
      setNewName("");
      return;
    }
    const dup = p.playlists.some((pl) => pl.name.toLowerCase() === name.toLowerCase());
    if (dup) {
      setNameError(t("playlistNameTaken"));
      return;
    }
    setNameError("");
    p.onCreatePlaylist(name);
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
          onClick={() => {
            if (!firedRef.current) p.onOpenCredits();
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{ background: "var(--accent-grad)" }}
          title={t("aboutRowDesc")}
          aria-label={t("aboutRowTitle")}
        >
          ♪
        </button>
        <div className="flex-1">
          <div className="font-display text-base font-bold tracking-wide leading-none">{t("appName").toUpperCase()}</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">{t("appTagline")}</div>
        </div>
        <button onClick={p.onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white lg:hidden" aria-label={t("close")}>
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
          {t("library")}
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
          {t("favorites")}
        </button>
        <button
          className={`${btn} ${p.recentOpen && !p.favOnly ? "bg-white/[0.07] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white"}`}
          onClick={() => {
            p.onRecent();
            p.onClose();
          }}
        >
          <IconClock className="h-[18px] w-[18px]" />
          {t("recent")}
        </button>
      </nav>

      {/* Плейлисты */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">{t("playlists")}</span>
          <button
            onClick={() => setCreating((c) => !c)}
            className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white"
            title={t("newPlaylist")}
            aria-label={t("newPlaylist")}
          >
            <IconPlus className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
        </div>
        <div className="scroll-thin max-h-[170px] space-y-0.5 overflow-y-auto pr-1">
          {creating && (
            <div>
              <input
                autoFocus
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (nameError) setNameError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitCreate();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                    setNameError("");
                  }
                }}
                onBlur={commitCreate}
                placeholder={t("playlistNamePlaceholder")}
                className={`w-full rounded-lg border bg-black/25 px-2.5 py-1.5 text-[13px] font-semibold text-white outline-none placeholder:text-white/25 ${
                  nameError ? "border-red-400/70" : "border-[var(--accent)]/60"
                }`}
              />
              {nameError && <div className="mt-1 px-1 text-[10px] font-bold text-red-400">{nameError}</div>}
            </div>
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
                  aria-label={t("remove")}
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          {!p.playlists.length && !creating && (
            <div className="px-2.5 py-1 text-[11px] leading-relaxed text-white/25">{t("playlistsEmptyHint")}</div>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <button
          onClick={p.onAddFiles}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: "var(--accent-grad)", boxShadow: "0 8px 24px -8px var(--accent)" }}
        >
          <IconPlus className="h-4 w-4" strokeWidth={3} />
          {t("addFiles")}
        </button>
        <button
          onClick={p.onAddFolder}
          className="glass flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <IconFolder className="h-4 w-4" />
          {t("chooseMusicFolder")}
        </button>
        <button
          onClick={p.onOpenDownload}
          className="glass flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <IconDownload className="h-4 w-4" />
          {t("downloadMusic")}
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
              {t("sync")}
            </button>
            <button
              onClick={p.onOpenFolder}
              className="flex-1 rounded-lg bg-white/[0.07] py-1.5 text-[11px] font-bold text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white"
            >
              {t("inExplorer")}
            </button>
          </div>
        </div>
      )}

      <div className="glass sidebar-stats mt-4 rounded-2xl p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">{t("libraryStats")}</div>
        <div className="mt-2 flex items-end justify-between">
          <div className="font-display text-2xl font-bold">{p.count}</div>
          <div className="pb-0.5 text-xs font-semibold text-white/45">
            {countText(lang, p.count, t("countTracksOne"), t("countTracksFew"), t("countTracksMany"))}
          </div>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, p.total / 600)}%`, background: "var(--accent)" }} />
        </div>
        <div className="mt-1.5 text-[11px] text-white/35">
          {formatTotal(p.total, lang)} {t("ofAudio")}
        </div>
      </div>

      <div className="flex-1" />

      <div className="space-y-2">
        <button
          onClick={p.onOpenSettings}
          className={`${btn} text-white/55 hover:bg-white/[0.04] hover:text-white`}
        >
          <IconSettings className="h-[18px] w-[18px]" />
          {t("settings")}
        </button>
      </div>

      <div className="mt-4 hidden items-center gap-2 px-1 text-[10px] font-medium text-white/25 lg:flex">
        <IconMenu className="h-3 w-3" />
        {t("menuHintSearch")} <span className="rounded bg-white/10 px-1 py-0.5">Ctrl+K</span>
      </div>
    </aside>
  );
}
