import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { loadMeta } from "../lib/db";
import { themeCss, THEMES } from "../theme/themes";
import { useI18n } from "../lib/i18n";
import { formatTime } from "../lib/format";
import {
  IconMove,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconSettings,
  IconVolume,
  IconX,
} from "../components/icons";
import type { MiniPlayerState } from "../electron.d";

type Preset = "standard" | "compact" | "bar" | "cover";

const PRESET_SIZES: Record<Preset, [number, number]> = {
  standard: [420, 176],
  compact: [380, 104],
  bar: [480, 72],
  cover: [320, 372],
};

const SETTINGS_KEY = "volna-mini-settings";

interface MiniSettings {
  preset: Preset;
  bgOn: boolean;
}

function loadSettings(): MiniSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as MiniSettings;
      if (["standard", "compact", "bar", "cover"].includes(s.preset)) {
        return { preset: s.preset, bgOn: s.bgOn !== false };
      }
    }
  } catch {
    /* нет настроек */
  }
  return { preset: "standard", bgOn: true };
}

/**
 * Оверлей-плеер — отдельное окно поверх всех (Electron, frameless, прозрачное),
 * как оверлей Discord: обложка, трек, прогресс с перемоткой, громкость,
 * назад/вперёд мышкой. Ctrl+Alt+M (или кнопка ✥) — режим перемещения:
 * фон слегка затемняется и оверлей можно перетащить куда угодно.
 * Клик по шестерёнке — настройки: пресеты вида и прозрачный фон.
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
  const [cfg, setCfg] = useState<MiniSettings>(loadSettings);
  const [panelOpen, setPanelOpen] = useState(false);
  const [moveMode, setMoveMode] = useState(false);

  const saveCfg = useCallback((next: MiniSettings) => {
    setCfg(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* квота */
    }
  }, []);

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
    // окно прозрачное — убираем фон у html/body
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
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
    const offState = window.volna.onMiniState((s) => setSt(s));
    const offMove = window.volna.onMiniMoveMode(() => {
      setPanelOpen(false);
      setMoveMode((m) => !m);
    });
    return () => {
      offState();
      offMove();
    };
  }, []);

  /* Esc — выйти из режима перемещения */
  useEffect(() => {
    if (!moveMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoveMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveMode]);

  const cmd = (c: string) => window.volna?.miniCommand(c);

  const dur = st.duration ?? 0;
  const cur = st.time ?? 0;
  const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;

  const seek = (sec: number) => cmd(`seek:${Math.round(sec)}`);
  const changeVol = (v: number) => {
    setVolume(v);
    try {
      localStorage.setItem("volna-mini-vol", String(v / 100));
    } catch {
      /* квота */
    }
    cmd(`volume:${v}`);
  };

  const applyPreset = (p: Preset) => {
    saveCfg({ ...cfg, preset: p });
    const [w, h] = PRESET_SIZES[p];
    window.volna?.miniResize(w, h);
  };

  const ctrl = "rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white";

  const renderControls = (small?: boolean): ReactNode => {
    const icon = small ? "h-4 w-4" : "h-5 w-5";
    return (
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={() => cmd("prev")}
          className={small ? "rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white" : ctrl}
          aria-label={t("back")}
        >
          <IconPrev className={icon} />
        </button>
        <button
          onClick={() => cmd("toggle")}
          className={`flex items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95 ${
            small ? "h-8 w-8" : "h-10 w-10"
          }`}
          style={{
            background: "var(--accent-grad)",
            boxShadow: "0 4px 16px -4px var(--accent)",
          }}
          aria-label={t("playPause")}
        >
          {st.playing ? <IconPause className={icon} /> : <IconPlay className={`${icon} translate-x-[1px]`} />}
        </button>
        <button
          onClick={() => cmd("next")}
          className={small ? "rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white" : ctrl}
          aria-label={t("forward")}
        >
          <IconNext className={icon} />
        </button>
      </div>
    );
  };

  const renderCover = (size: string): ReactNode => (
    <div className={`${size} shrink-0 overflow-hidden rounded-xl shadow-lg`}>
      {st.art ? (
        <img src={st.art} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-xl text-white/90"
          style={{
            background: "var(--accent-grad)",
          }}
        >
          ♪
        </div>
      )}
    </div>
  );

  const renderTrackInfo = (center?: boolean): ReactNode => (
    <div className={`min-w-0 flex-1 ${center ? "text-center" : ""}`}>
      <div className={`truncate text-sm font-bold text-white ${center ? "mx-auto" : ""}`}>{st.title || t("noTrack")}</div>
      <div className={`mt-0.5 flex items-center gap-2 ${center ? "justify-center" : ""}`}>
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
  );

  const renderSeekBar = (thin?: boolean): ReactNode => (
    <div className="flex items-center gap-2">
      {!thin && (
        <span className="w-9 shrink-0 text-right text-[10px] font-semibold tabular-nums text-white/40">{formatTime(cur)}</span>
      )}
      <input
        type="range"
        min={0}
        max={dur > 0 ? Math.round(dur) : 1}
        value={Math.round(cur)}
        onChange={(e) => seek(Number(e.target.value))}
        disabled={dur <= 0}
        className={`slider w-full ${thin ? "h-1" : ""}`}
        style={{ "--fill": `${pct}%` } as CSSProperties}
        aria-label={t("seek")}
      />
      {!thin && (
        <span className="w-9 shrink-0 text-[10px] font-semibold tabular-nums text-white/40">
          {dur > 0 ? formatTime(dur) : "—:——"}
        </span>
      )}
    </div>
  );

  const renderVolume = (): ReactNode => (
    <div
      className={`no-drag flex shrink-0 items-center gap-1.5 transition-opacity ${
        hover ? "opacity-100" : "opacity-0"
      }`}
    >
      <button
        onClick={() => changeVol(volume === 0 ? 50 : 0)}
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
        value={volume}
        onChange={(e) => changeVol(Number(e.target.value))}
        className="slider w-16"
        style={{ "--fill": `${volume}%` } as CSSProperties}
        aria-label={t("masterVolume")}
      />
    </div>
  );

  /* ---------- содержимое по пресету ---------- */
  let body: ReactNode = null;
  if (cfg.preset === "standard") {
    body = (
      <>
        <div className="no-drag relative z-20 flex min-h-0 flex-1 items-center gap-3 px-4 pt-2" style={{ minWidth: 0 }}>
          {renderCover("h-14 w-14")}
          {renderTrackInfo()}
          {renderControls()}
          {renderVolume()}
        </div>
        <div className="no-drag relative z-20 px-4 pb-2.5 pt-1">
          {renderSeekBar()}
        </div>
      </>
    );
  } else if (cfg.preset === "compact") {
    body = (
      <div className="no-drag relative z-20 flex h-full items-center gap-3 px-4" style={{ minWidth: 0 }}>
        {renderCover("h-11 w-11")}
        {renderTrackInfo()}
        {renderControls(true)}
      </div>
    );
  } else if (cfg.preset === "bar") {
    body = (
      <div className="relative flex h-full flex-col">
        <div className="no-drag relative z-20 flex flex-1 items-center gap-2.5 px-3 pb-1" style={{ minWidth: 0 }}>
          {renderCover("h-9 w-9")}
          {renderTrackInfo()}
          {renderControls(true)}
        </div>
        <div className="no-drag relative z-20 px-3 pb-1">
          {renderSeekBar(true)}
        </div>
      </div>
    );
  } else {
    // cover — большая обложка
    body = (
      <div className="flex h-full flex-col">
        <div className="no-drag relative z-20 min-h-0 flex-1 px-3 pt-3">
          <div className="h-full w-full overflow-hidden rounded-2xl shadow-lg">
            {st.art ? (
              <img src={st.art} alt="" className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-5xl text-white/90"
                style={{
                  background: "var(--accent-grad)",
                }}
              >
                ♪
              </div>
            )}
          </div>
        </div>
        <div className="no-drag relative z-20 px-4 pb-3 pt-2.5">
          {renderTrackInfo(true)}
          <div className="mt-2 flex justify-center">
            {renderControls()}
          </div>
          <div className="mt-1.5">
            {renderSeekBar(true)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen select-none overflow-hidden">
      <style id="volna-theme">{themeVars}</style>
      <style id="volna-css">{cssOn ? css : ""}</style>

      {/* фон окна: тема+обои либо прозрачность */}
      {cfg.bgOn ? (
        <div className="absolute inset-0 rounded-2xl bg-[var(--bg-base)] shadow-2xl">
          {wallpaper && (
            <>
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl bg-cover bg-center"
                style={{ backgroundImage: `url("${wallpaper}")` }}
              />
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background: `rgba(5,7,12,${wallDim})`,
                  backdropFilter: wallBlur > 0 ? `blur(${wallBlur}px)` : undefined,
                }}
              />
            </>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 rounded-2xl bg-black/55 shadow-2xl backdrop-blur-xl" />
      )}

      <div
        className="relative z-10 flex h-full w-full flex-col"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* зона перетаскивания frameless-окна */}
        {!moveMode && <div className="drag-region absolute inset-0" />}

        {/* кнопки в углу: настройки, перемещение, развернуть */}
        {!moveMode && (
          <div
            className={`no-drag absolute right-2 top-2 z-30 flex items-center gap-1 rounded-lg bg-black/40 p-0.5 transition-all ${
              hover ? "opacity-100" : "opacity-0"
            }`}
          >
            <button
              onClick={() => setPanelOpen((o) => !o)}
              className={`rounded-md p-1 text-white/70 transition-all hover:bg-white/20 hover:text-white ${
                panelOpen ? "text-[var(--accent)]" : ""
              }`}
              title={t("mpSettings")}
              aria-label={t("mpSettings")}
            >
              <IconSettings className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setMoveMode(true)}
              className="rounded-md p-1 text-white/70 transition-all hover:bg-white/20 hover:text-white"
              title={t("mpMove")}
              aria-label={t("mpMove")}
            >
              <IconMove className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => cmd("open-full")}
              className="rounded-md p-1 text-white/70 transition-all hover:bg-red-500/30 hover:text-white"
              title={t("expand")}
              aria-label={t("expand")}
            >
              <IconX className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {body}

        {/* ===== панель настроек оверлея ===== */}
        {panelOpen && !moveMode && (
          <div className="no-drag anim-in absolute inset-0 z-40 flex flex-col rounded-2xl bg-[#0c1018]/95 p-3.5 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">{t("mpSettings")}</div>
              <button
                onClick={() => setPanelOpen(false)}
                className="rounded-md p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={t("close")}
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{t("mpView")}</div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {([
                ["standard", t("mpPresetStandard")],
                ["compact", t("mpPresetCompact")],
                ["bar", t("mpPresetBar")],
                ["cover", t("mpPresetCover")],
              ] as Array<[Preset, string]>).map(([p, label]) => (
                <button
                  key={p}
                  onClick={() => applyPreset(p)}
                  className={`rounded-xl px-2 py-2 text-xs font-bold transition-all active:scale-95 ${
                    cfg.preset === p
                      ? "bg-[var(--accent)] text-white shadow-[0_3px_12px_-3px_var(--accent)]"
                      : "bg-white/[0.07] text-white/60 hover:bg-white/[0.14] hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{t("mpBgTitle")}</div>
            <div className="mt-1.5 flex gap-1.5">
              <button
                onClick={() => saveCfg({ ...cfg, bgOn: true })}
                className={`flex-1 rounded-xl px-2 py-2 text-xs font-bold transition-all active:scale-95 ${
                  cfg.bgOn
                    ? "bg-[var(--accent)] text-white shadow-[0_3px_12px_-3px_var(--accent)]"
                    : "bg-white/[0.07] text-white/60 hover:bg-white/[0.14] hover:text-white"
                }`}
              >
                {t("mpBgTheme")}
              </button>
              <button
                onClick={() => saveCfg({ ...cfg, bgOn: false })}
                className={`flex-1 rounded-xl px-2 py-2 text-xs font-bold transition-all active:scale-95 ${
                  !cfg.bgOn
                    ? "bg-[var(--accent)] text-white shadow-[0_3px_12px_-3px_var(--accent)]"
                    : "bg-white/[0.07] text-white/60 hover:bg-white/[0.14] hover:text-white"
                }`}
              >
                {t("mpBgTransparent")}
              </button>
            </div>

            <div className="mt-auto pt-2 text-center text-[10px] font-medium text-white/25">Ctrl+Alt+M — {t("mpMove").split(" (")[0].toLowerCase()}</div>
          </div>
        )}

        {/* ===== режим перемещения (Ctrl+Alt+M) ===== */}
        {moveMode && (
          <>
            {/* весь оверлей — зона перетаскивания, фон затемнён */}
            <div className="drag-region absolute inset-0 z-50 rounded-2xl bg-black/50">
              <div className="pointer-events-none flex h-full items-start justify-center pt-5">
                <span className="rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold text-white/85">
                  ✥ {t("mpMoveHint")}
                </span>
              </div>
            </div>
            <button
              onClick={() => setMoveMode(false)}
              className="no-drag absolute bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-white shadow-lg transition-all hover:brightness-110 active:scale-95"
            >
              {t("mpMoveFinish")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
