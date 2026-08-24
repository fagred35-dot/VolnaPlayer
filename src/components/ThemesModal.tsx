import { useRef, useState, type CSSProperties } from "react";
import { CSS_SNIPPETS, THEME_VARS, THEMES } from "../theme/themes";
import { useI18n } from "../lib/i18n";
import { IconCode, IconDice, IconImage, IconPalette, IconX } from "./icons";

interface Props {
  themeId: string;
  onTheme: (id: string) => void;
  onRandom: () => void;
  wallpaper: string | null;
  onWallpaperFile: (f: File) => void;
  onWallpaperUrl: (u: string) => void;
  onWallpaperClear: () => void;
  wallDim: number;
  onWallDim: (v: number) => void;
  wallBlur: number;
  onWallBlur: (v: number) => void;
  customCss: string;
  onCss: (s: string) => void;
  cssEnabled: boolean;
  onCssEnabled: (b: boolean) => void;
  onReset: () => void;
  onClose: () => void;
}

type Tab = "themes" | "wall" | "css";

const AI_STYLE_CHIPS = [
  "cyberpunk neon",
  "glassmorphism",
  "vintage warm",
  "deep space",
  "minimal mono",
  "grunge",
  "soft light",
  "aurora",
];

/** Промпт на английском для ИИ-генератора CSS-темы */
function buildAiPrompt(style: string): string {
  return `You are a UI theme designer for "Volna" — a music player desktop app (React + Tailwind CSS, Electron).

Create a complete CSS theme for this style: "${style || "custom"}"
The whole UI is styled with CSS custom properties. Output ONLY one self-contained CSS block wrapped in a single \`\`\`css ... \`\`\` fence. No explanations, no extra text.

Requirements:
1. Start with :root { ... } that overrides ALL the variables listed below (keep the full list, adapt values to the style).
2. Dark theme by default — use light colors ONLY if the style clearly implies a light theme.
3. Keep text readable: strong contrast between background and text colors.
4. You may add extra component styles using ONLY these class names:
   .app-header, .player-bar, .bg-app, .glass, .bg-surface, .bg-panel, .bg-side,
   .track-cover (album art), .artist-col (artist column in playlist), .sidebar-stats, .sidebar-meta,
   .eq-bar (equalizer bars), .disc-spin (vinyl), #volume-slider, .scroll-thin
5. Add effects that fit the style (gradients, glows, blur, borders) but keep it lightweight — no heavy animations, no background images.

CSS variables you MUST define (with their meaning):
--accent      → primary color: buttons, active elements, slider fill
--bg-base     → app background color
--glow-a      → background radial glow #1 (rgba)
--glow-b      → background radial glow #2 (rgba)
--side-bg     → sidebar background
--surface     → bottom player bar background
--panel       → popups / modals background
--overlay     → fullscreen overlay background
--t1          → primary text color
--t2          → secondary text color
--t3          → muted / hint text color
--line        → borders and dividers color
--glass-bg    → glass card background
--glass-strong→ glass background on hover / active
--glass-border→ glass card border color
--track       → slider track / subtle fills color

Return the CSS code now.`;
}

export default function ThemesModal(p: Props) {
  const { t } = useI18n();
  const TABS: Array<{ id: Tab; name: string; icon: typeof IconPalette }> = [
    { id: "themes", name: t("tabThemes"), icon: IconPalette },
    { id: "wall", name: t("tabWallpaper"), icon: IconImage },
    { id: "css", name: t("tabCss"), icon: IconCode },
  ];
  const [tab, setTab] = useState<Tab>("themes");
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const current = THEMES.find((t) => t.id === p.themeId) ?? THEMES[0];

  /* ---------- ИИ-генератор промпта ---------- */
  const [aiChip, setAiChip] = useState("");
  const [aiStyle, setAiStyle] = useState("");
  const [promptOut, setPromptOut] = useState("");
  const [copied, setCopied] = useState(false);
  const [aiAnswer, setAiAnswer] = useState("");

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptOut);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* буфер недоступен */
    }
  };

  const applyAiAnswer = () => {
    const m = aiAnswer.match(/```(?:css)?\s*([\s\S]*?)```/);
    const css = (m ? m[1] : aiAnswer).trim();
    if (!css || !css.includes("{")) return;
    p.onCss(css);
    p.onCssEnabled(true);
    setAiAnswer("");
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6"
        onClick={(e) => {
          if (e.target === e.currentTarget) p.onClose();
        }}
      >
        <div
          className="anim-in glass bg-panel flex max-h-[88vh] w-full max-w-[760px] flex-col rounded-3xl p-5 shadow-2xl sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Шапка */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
                <IconPalette className="h-5 w-5" />
              </span>
              <div>
                <div className="font-display text-lg font-bold">{t("themesTitle")}</div>
                <div className="text-xs font-medium text-white/40">{t("themesSubtitle")}</div>
              </div>
            </div>
            <button
              onClick={p.onClose}
              className="rounded-xl bg-white/[0.06] p-2 text-white/60 transition-all hover:bg-white/[0.12] hover:text-white active:scale-90"
              aria-label={t("close")}
            >
              <IconX className="h-5 w-5" />
            </button>
          </div>

          {/* Табы */}
          <div className="mb-4 flex gap-1 rounded-xl bg-white/[0.05] p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition-all ${
                  tab === t.id
                    ? "bg-[var(--accent)] text-white shadow-[0_4px_16px_-4px_var(--accent)]"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.name}
              </button>
            ))}
          </div>

          {/* ============ ТЕМЫ ============ */}
          {tab === "themes" && (
            <div className="scroll-thin overflow-y-auto pr-1">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
                  {t("readyThemesNow", { current: `${current.emoji} ${current.name}` })}
                </span>
                <button
                  onClick={p.onRandom}
                  className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white active:scale-95"
                >
                  <IconDice className="h-3.5 w-3.5" />
                  {t("randomTheme")}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pb-2 sm:grid-cols-3">
                {THEMES.map((t) => {
                  const sel = t.id === p.themeId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => p.onTheme(t.id)}
                      className={`group rounded-2xl p-2 text-left transition-all active:scale-[0.97] ${
                        sel ? "bg-[var(--accent)]/12 ring-2 ring-[var(--accent)]" : "bg-white/[0.045] hover:bg-white/[0.08]"
                      }`}
                    >
                      <div
                        className="h-14 w-full rounded-xl"
                        style={{ background: `linear-gradient(135deg, ${t.vars["--accent"]} 0%, ${t.vars["--bg-base"]} 95%)` }}
                      />
                      <div className="mt-2 flex items-center gap-1.5 px-0.5">
                        <span className="text-sm">{t.emoji}</span>
                        <span className={`text-xs font-bold ${sel ? "text-[var(--accent)]" : "text-white/75"}`}>{t.name}</span>
                        {sel && <span className="ml-auto text-[10px] font-extrabold text-[var(--accent)]">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============ ОБОИ ============ */}
          {tab === "wall" && (
            <div className="scroll-thin overflow-y-auto pr-1">
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                  {p.wallpaper ? (
                    <img src={p.wallpaper} alt={t("tabWallpaper")} className="h-full w-full object-cover" />
                  ) : (
                    <IconImage className="h-8 w-8 text-white/25" />
                  )}
                </div>
                <div className="w-full flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95"
                    >
                      <IconImage className="h-4 w-4" />
                      {t("uploadWallpaper")}
                    </button>
                    {p.wallpaper && (
                      <button
                        onClick={p.onWallpaperClear}
                        className="rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-bold text-white/70 transition-colors hover:bg-red-500/15 hover:text-red-300"
                      >
                        {t("wallpaperRemove")}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && url.trim()) {
                          p.onWallpaperUrl(url.trim());
                          setUrl("");
                        }
                      }}
                      placeholder={t("wallpaperUrlPlaceholder")}
                      className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-medium text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]/60"
                    />
                    <button
                      onClick={() => {
                        if (url.trim()) {
                          p.onWallpaperUrl(url.trim());
                          setUrl("");
                        }
                      }}
                      className="shrink-0 rounded-xl bg-white/[0.07] px-3.5 py-2 text-xs font-bold text-white/70 transition-colors hover:bg-white/[0.14] hover:text-white"
                    >
                      {t("ok")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-2 rounded-xl bg-[var(--accent)]/8 px-3 py-2 text-[11px] font-semibold text-white/50">
                {t("wallpaperGifNote")}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-1.5 flex justify-between text-[11px] font-bold text-white/50">
                    <span>{t("wallDim")}</span>
                    <span className="text-[var(--accent)]">{Math.round(p.wallDim * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={85}
                    value={Math.round(p.wallDim * 100)}
                    onChange={(e) => p.onWallDim(Number(e.target.value) / 100)}
                    className="modal-slider"
                    style={{ "--fill": `${Math.round(p.wallDim * 100)}%` } as CSSProperties}
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex justify-between text-[11px] font-bold text-white/50">
                    <span>{t("wallBlur")}</span>
                    <span className="text-[var(--accent)]">{Math.round(p.wallBlur)}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={Math.round(p.wallBlur)}
                    onChange={(e) => p.onWallBlur(Number(e.target.value))}
                    className="modal-slider"
                    style={{ "--fill": `${(p.wallBlur / 30) * 100}%` } as CSSProperties}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ============ CSS-КОД ============ */}
          {tab === "css" && (
            <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
                  {t("customCssInstant")}
                </span>
                <button
                  onClick={() => p.onCssEnabled(!p.cssEnabled)}
                  className={`relative rounded-full transition-colors ${p.cssEnabled ? "bg-[var(--accent)]" : "bg-white/15"}`}
                  style={{ width: 44, height: 24 }}
                  aria-label={t("cssToggle")}
                >
                  <span
                    className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all"
                    style={{ left: p.cssEnabled ? 22 : 3 }}
                  />
                </button>
              </div>

              <textarea
                value={p.customCss}
                onChange={(e) => p.onCss(e.target.value)}
                spellCheck={false}
                placeholder={`.track-cover { border-radius: 999px; }\n:root { --accent: #ff00aa; }\n.app-header { display: none; }`}
                className="scroll-thin h-40 w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-xs leading-relaxed text-[#7ee787] outline-none placeholder:text-white/20 focus:border-[var(--accent)]/50"
              />

              <div className="mt-2 flex flex-wrap gap-1.5">
                {CSS_SNIPPETS.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => p.onCss(s.css)}
                    className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold text-white/60 transition-all hover:bg-white/[0.12] hover:text-white active:scale-95"
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              {/* 🤖 ИИ-генератор промпта */}
              <div className="mt-3 rounded-2xl bg-white/[0.04] p-3">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">
                  {t("aiGenerator")}
                </div>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-white/35">
                  {t("aiGeneratorHint")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {AI_STYLE_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => setAiChip(chip === aiChip ? "" : chip)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-all active:scale-95 ${
                        aiChip === chip
                          ? "bg-[var(--accent)] text-white"
                          : "bg-white/[0.06] text-white/55 hover:bg-white/[0.12] hover:text-white"
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <textarea
                  value={aiStyle}
                  onChange={(e) => setAiStyle(e.target.value)}
                  placeholder={t("aiStylePlaceholder")}
                  className="mt-2 h-16 w-full resize-none rounded-xl border border-white/10 bg-black/25 p-2.5 text-xs font-medium text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]/60"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setPromptOut(buildAiPrompt([aiChip, aiStyle].filter(Boolean).join(", ")))}
                    className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-bold text-white transition-all hover:brightness-110 active:scale-95"
                  >
                    {t("buildPrompt")}
                  </button>
                  {promptOut && (
                    <button
                      onClick={copyPrompt}
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition-all active:scale-95 ${
                        copied ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.07] text-white/70 hover:bg-white/[0.14] hover:text-white"
                      }`}
                    >
                      {copied ? t("copied") : t("copy")}
                    </button>
                  )}
                </div>
                {promptOut && (
                  <textarea
                    readOnly
                    value={promptOut}
                    className="mt-2 h-40 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[10px] leading-relaxed text-white/70 outline-none"
                  />
                )}

                <div className="mt-3 border-t border-white/[0.07] pt-2.5">
                  <div className="text-[11px] font-semibold text-white/40">
                    {t("pasteAiAnswer").split("<code>")[0]}
                    <code className="text-white/60">```css ... ```</code>
                    {t("pasteAiAnswer").split("</code>")[1]}
                  </div>
                  <div className="mt-1.5 flex gap-2">
                    <textarea
                      value={aiAnswer}
                      onChange={(e) => setAiAnswer(e.target.value)}
                      placeholder={t("pasteAiPlaceholder")}
                      className="h-16 flex-1 resize-none rounded-xl border border-white/10 bg-black/25 p-2.5 font-mono text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]/60"
                    />
                    <button
                      onClick={applyAiAnswer}
                      disabled={!aiAnswer.trim()}
                      className="shrink-0 rounded-xl bg-white/[0.07] px-3.5 text-xs font-bold text-white/70 transition-colors hover:bg-white/[0.14] hover:text-white disabled:opacity-30"
                    >
                      {t("apply")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl bg-white/[0.04] p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                  {t("themeVarsTitle")}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {THEME_VARS.map((v) => (
                    <code key={v} className="rounded-md bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-[var(--accent)]">
                      {v}
                    </code>
                  ))}
                </div>
                <div className="mt-2 text-[10px] font-medium leading-relaxed text-white/30">
                  {t("themeVarsExample").split("<code>")[0]}
                  <code className="text-white/60">:root {"{ --accent: #ff00aa; --bg-base: #000; }"}</code>
                  {t("themeVarsExample").split("</code>")[1]}
                  <code className="text-white/60">.app-header, .artist-col, .track-cover, .sidebar-stats</code>.
                </div>
              </div>
            </div>
          )}

          {/* Футер */}
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
            <button
              onClick={p.onReset}
              className="rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/20 active:scale-95"
            >
              {t("resetAll")}
            </button>
            <span className="text-[10px] font-medium text-white/25">{t("savedAutomatically")}</span>
          </div>
        </div>
      </div>

      {/* инпут вынесен за пределы оверлея, чтобы диалог файлов не закрывал модалку */}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) p.onWallpaperFile(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
