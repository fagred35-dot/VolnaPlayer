import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { loadMeta } from "../lib/db";
import { themeCss, THEMES } from "../theme/themes";
import { useI18n } from "../lib/i18n";
import { formatTime } from "../lib/format";
import { IconNext, IconPause, IconPlay, IconPrev, IconVolume, IconX } from "../components/icons";
import type { MiniPlayerState } from "../electron.d";

/**
 * Мини-плеер-оверлей — отдельное маленькое окно поверх всех (Electron, frameless),
 * как оверлей Discord: обложка, трек, прогресс с перемоткой, громкость,
 * переключение назад/вперёд мышкой. Управляет музыкой через IPC в основное окно,
 * темы синхронизирует через localStorage (storage-события между окнами).
 */
export default function MiniPlayer() {
  const { t } = useI18n();
  const [themeVars, setThemeVars] = useState("");
  const [css, setCss] = useState("");
  const [cssOn, setCssOn] = useState(true);
  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const [wallDim, setWallDim] = useState(0.35);
  const [wallBlur, setWallBlur] = useState(0);
  const [st, setSt] = useState<MiniPlayerState>({ title: "", artist: "", art: null, playing: false });
  const [hover, setHover] = useState(false);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);

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
    // громкость синхронизируется из основного окна через localStorage
    try {
      const v = localStorage.getItem("volna-mini-vol");
      if (v !== null) setVolume(Math.round(Number(v) * 100));
    } catch {
      /* нет данных */
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

  const dur = st.duration ?? 0;
  const cur = st.time ?? 0;
  const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;

  const seek = (sec: number) => cmd(`seek:${Math.round(sec)}`);
  const changeVol = (v: number) => {
    setVolume(v);
    setMuted(false);
    try {
      localStorage.setItem("volna-mini-vol", String(v / 100));
    } catch {
      /* квота */
    }
    cmd(`volume:${v}`);
  };

  const ctrl = "rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white";

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
        className="relative z-10 flex h-full w-full flex-col"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* зона перетаскивания frameless-окна */}
        <div className="drag-region absolute inset-0" />

        {/* крестик — развернуть полное окно */}
        <button
          onClick={() => cmd("open-full")}
          className={`no-drag absolute right-2 top-2 z-30 rounded-md bg-black/40 p-1 text-white/70 transition-all hover:bg-red-500/30 hover:text-white ${
            hover ? "opacity-100" : "opacity-0"
          }`}
          title={t("expand")}
          aria-label={t("expand")}
        >
          <IconX className="h-3.5 w-3.5" />
        </button>

        <div className="no-drag relative z-20 flex min-h-0 flex-1 items-center gap-3 px-4 pt-2" style={{ minWidth: 0 }}>
          {/* обложка */}
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-lg">
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
            <div className="truncate text-sm font-bold text-white">{st.title || t("noTrack")}</div>
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
          <div className="relative z-20 flex shrink-0 items-center gap-1">
            <button onClick={() => cmd("prev")} className={ctrl} aria-label={t("back")}>
              <IconPrev className="h-5 w-5" />
            </button>
            <button
              onClick={() => cmd("toggle")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95"
              style={{
                background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #22d3ee))",
                boxShadow: "0 4px 16px -4px var(--accent)",
              }}
              aria-label={t("playPause")}
            >
              {st.playing ? <IconPause className="h-5 w-5" /> : <IconPlay className="h-5 w-5 translate-x-[1px]" />}
            </button>
            <button onClick={() => cmd("next")} className={ctrl} aria-label={t("forward")}>
              <IconNext className="h-5 w-5" />
            </button>
          </div>

          {/* громкость — появляется при наведении на окно */}
          <div
            className={`no-drag relative z-20 flex shrink-0 items-center gap-1.5 transition-opacity ${
              hover ? "opacity-100" : "opacity-0"
            }`}
          >
            <button
              onClick={() => changeVol(muted || volume === 0 ? volume || 50 : 0)}
              className="rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={t("muteTitle")}
              title={t("muteTitle")}
            >
              <IconVolume className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={muted ? 0 : volume}
              onChange={(e) => changeVol(Number(e.target.value))}
              className="slider w-16"
              style={{ "--fill": `${muted ? 0 : volume}%` } as CSSProperties}
              aria-label={t("masterVolume")}
            />
          </div>
        </div>

        {/* прогресс с перемоткой */}
        <div className="no-drag relative z-20 flex items-center gap-2 px-4 pb-2.5 pt-1">
          <span className="w-9 shrink-0 text-right text-[10px] font-semibold tabular-nums text-white/40">
            {formatTime(cur)}
          </span>
          <input
            type="range"
            min={0}
            max={dur > 0 ? Math.round(dur) : 1}
            value={Math.round(cur)}
            onChange={(e) => seek(Number(e.target.value))}
            disabled={dur <= 0}
            className="slider w-full"
            style={{ "--fill": `${pct}%` } as CSSProperties}
            aria-label={t("seek")}
          />
          <span className="w-9 shrink-0 text-[10px] font-semibold tabular-nums text-white/40">
            {dur > 0 ? formatTime(dur) : "—:——"}
          </span>
        </div>
      </div>
    </div>
  );
}
