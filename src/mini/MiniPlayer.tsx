import { useCallback, useEffect, useState } from "react";
import { loadMeta } from "../lib/db";
import { themeCss, THEMES } from "../theme/themes";
import { IconNext, IconPause, IconPlay, IconPrev, IconX } from "../components/icons";
import type { MiniPlayerState } from "../electron.d";

/**
 * Мини-плеер — отдельное маленькое окно (Electron, frameless).
 * Управляет музыкой через IPC в основное окно, темы синхронизирует
 * через localStorage (storage-события между окнами).
 */
export default function MiniPlayer() {
  const [themeVars, setThemeVars] = useState("");
  const [css, setCss] = useState("");
  const [cssOn, setCssOn] = useState(true);
  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const [wallDim, setWallDim] = useState(0.35);
  const [wallBlur, setWallBlur] = useState(0);
  const [st, setSt] = useState<MiniPlayerState>({ title: "", artist: "", art: null, playing: false });
  const [hover, setHover] = useState(false);

  const loadTheme = useCallback(() => {
    try {
      const raw = localStorage.getItem("volna-theme-v1");
      if (raw) {
        const s = JSON.parse(raw) as { themeId?: string; dim?: number; blur?: number; css?: string; cssEnabled?: boolean };
        const theme = THEMES.find((t) => t.id === s.themeId) ?? THEMES[0];
        setThemeVars(themeCss(theme));
        if (typeof s.dim === "number") setWallDim(s.dim);
        if (typeof s.blur === "number") setWallBlur(s.blur);
        if (typeof s.css === "string") setCss(s.css);
        if (typeof s.cssEnabled === "boolean") setCssOn(s.cssEnabled);
      }
    } catch {
      /* нет сохранённой темы */
    }
  }, []);

  const loadWall = useCallback(() => {
    loadMeta<string>("wallpaper")
      .then((w) => setWallpaper(w ?? null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadTheme();
    loadWall();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "volna-theme-v1") loadTheme();
      if (e.key === "volna-sync") {
        loadTheme();
        loadWall();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [loadTheme, loadWall]);

  useEffect(() => {
    if (!window.volna) return;
    return window.volna.onMiniState((s) => setSt(s));
  }, []);

  const cmd = (c: string) => window.volna?.miniCommand(c);

  return (
    <div className="relative h-screen w-screen select-none overflow-hidden bg-[var(--bg-base)]">
      <style id="volna-theme">{themeVars}</style>
      <style id="volna-css">{cssOn ? css : ""}</style>
      {wallpaper && (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${wallpaper}")` }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `rgba(5,7,12,${wallDim})`,
              backdropFilter: wallBlur > 0 ? `blur(${wallBlur}px)` : undefined,
            }}
          />
        </>
      )}

      <div
        className="relative z-10 flex h-full w-full items-center gap-3 px-4"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ minWidth: 0 }}
      >
        {/* зона перетаскивания frameless-окна */}
        <div className="drag-region absolute inset-0" />

        {/* крестик — развернуть полное окно */}
        <button
          onClick={() => cmd("open-full")}
          className={`no-drag absolute right-2 top-2 z-30 rounded-md bg-black/40 p-1 text-white/70 transition-all hover:bg-red-500/30 hover:text-white ${
            hover ? "opacity-100" : "opacity-0"
          }`}
          title="Развернуть"
          aria-label="Развернуть"
        >
          <IconX className="h-3.5 w-3.5" />
        </button>

        {/* обложка */}
        <div className="no-drag relative z-20 h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-lg">
          {st.art ? (
            <img src={st.art} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-xl text-white/90"
              style={{
                background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 50%, #22d3ee))",
              }}
            >
              ♪
            </div>
          )}
        </div>

        {/* название + индикатор */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-white">{st.title || "Нет трека"}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="truncate text-xs text-white/45">{st.artist || "—"}</span>
            {st.playing && (
              <span className="flex h-3 shrink-0 items-end gap-[2px]" style={{ color: "var(--accent)" }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="eq-bar w-[2.5px] rounded-full bg-current"
                    style={{ height: "100%", animationDelay: `${i * 0.18}s` }}
                  />
                ))}
              </span>
            )}
          </div>
        </div>

        {/* управление */}
        <div className="no-drag relative z-20 flex items-center gap-1.5">
          <button
            onClick={() => cmd("prev")}
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Назад"
          >
            <IconPrev className="h-5 w-5" />
          </button>
          <button
            onClick={() => cmd("toggle")}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #22d3ee))",
              boxShadow: "0 4px 16px -4px var(--accent)",
            }}
            aria-label="Играть / Пауза"
          >
            {st.playing ? <IconPause className="h-5 w-5" /> : <IconPlay className="h-5 w-5 translate-x-[1px]" />}
          </button>
          <button
            onClick={() => cmd("next")}
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Вперёд"
          >
            <IconNext className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
