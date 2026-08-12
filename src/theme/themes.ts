export interface ThemeDef {
  id: string;
  name: string;
  emoji: string;
  vars: Record<string, string>;
}

const DARK_BASE: Record<string, string> = {
  "--side-bg": "rgba(0,0,0,0.2)",
  "--surface": "rgba(12,16,24,0.92)",
  "--panel": "#10141d",
  "--overlay": "rgba(7,9,15,0.85)",
  "--t1": "rgba(247,249,252,0.95)",
  "--t2": "rgba(255,255,255,0.55)",
  "--t3": "rgba(255,255,255,0.32)",
  "--line": "rgba(255,255,255,0.07)",
  "--glass-bg": "rgba(255,255,255,0.045)",
  "--glass-strong": "rgba(255,255,255,0.08)",
  "--glass-border": "rgba(255,255,255,0.08)",
  "--track": "rgba(255,255,255,0.13)",
};

export const THEMES: ThemeDef[] = [
  {
    id: "volna",
    name: "Волна",
    emoji: "🌊",
    vars: {
      ...DARK_BASE,
      "--accent": "#8b5cf6",
      "--bg-base": "#0a0d14",
      "--glow-a": "rgba(139,92,246,0.13)",
      "--glow-b": "rgba(34,211,238,0.06)",
    },
  },
  {
    id: "neon",
    name: "Неон",
    emoji: "💠",
    vars: {
      ...DARK_BASE,
      "--accent": "#22d3ee",
      "--bg-base": "#05090d",
      "--glow-a": "rgba(34,211,238,0.16)",
      "--glow-b": "rgba(232,121,249,0.10)",
    },
  },
  {
    id: "cyber",
    name: "Киберпанк",
    emoji: "⚡",
    vars: {
      ...DARK_BASE,
      "--accent": "#facc15",
      "--bg-base": "#0a0710",
      "--glow-a": "rgba(250,204,21,0.14)",
      "--glow-b": "rgba(34,211,238,0.10)",
    },
  },
  {
    id: "blood",
    name: "Кровавая луна",
    emoji: "🔴",
    vars: {
      ...DARK_BASE,
      "--accent": "#f43f5e",
      "--bg-base": "#0e060a",
      "--glow-a": "rgba(244,63,94,0.16)",
      "--glow-b": "rgba(120,20,40,0.10)",
    },
  },
  {
    id: "sunset",
    name: "Закат",
    emoji: "🌇",
    vars: {
      ...DARK_BASE,
      "--accent": "#fb923c",
      "--bg-base": "#120a08",
      "--glow-a": "rgba(251,146,60,0.15)",
      "--glow-b": "rgba(236,72,153,0.09)",
    },
  },
  {
    id: "emerald",
    name: "Изумруд",
    emoji: "🌿",
    vars: {
      ...DARK_BASE,
      "--accent": "#34d399",
      "--bg-base": "#05100b",
      "--glow-a": "rgba(52,211,153,0.14)",
      "--glow-b": "rgba(16,185,129,0.07)",
    },
  },
  {
    id: "ocean",
    name: "Океан",
    emoji: "🐬",
    vars: {
      ...DARK_BASE,
      "--accent": "#38bdf8",
      "--bg-base": "#060b12",
      "--glow-a": "rgba(56,189,248,0.15)",
      "--glow-b": "rgba(14,165,233,0.08)",
    },
  },
  {
    id: "lavender",
    name: "Лаванда",
    emoji: "💜",
    vars: {
      ...DARK_BASE,
      "--accent": "#c084fc",
      "--bg-base": "#0d0912",
      "--glow-a": "rgba(192,132,252,0.16)",
      "--glow-b": "rgba(139,92,246,0.08)",
    },
  },
  {
    id: "retro",
    name: "Ретро",
    emoji: "📻",
    vars: {
      ...DARK_BASE,
      "--accent": "#f59e0b",
      "--bg-base": "#140f08",
      "--glow-a": "rgba(245,158,11,0.15)",
      "--glow-b": "rgba(222,88,40,0.09)",
    },
  },
  {
    id: "light",
    name: "Светлая",
    emoji: "☀️",
    vars: {
      "--accent": "#7c5cf0",
      "--bg-base": "#eef1f7",
      "--glow-a": "rgba(124,92,240,0.12)",
      "--glow-b": "rgba(56,189,248,0.10)",
      "--side-bg": "rgba(255,255,255,0.72)",
      "--surface": "rgba(255,255,255,0.88)",
      "--panel": "#ffffff",
      "--overlay": "rgba(240,243,249,0.92)",
      "--t1": "rgba(18,22,32,0.92)",
      "--t2": "rgba(18,22,32,0.60)",
      "--t3": "rgba(18,22,32,0.40)",
      "--line": "rgba(18,22,32,0.09)",
      "--glass-bg": "rgba(255,255,255,0.6)",
      "--glass-strong": "rgba(255,255,255,0.82)",
      "--glass-border": "rgba(18,22,32,0.10)",
      "--track": "rgba(18,22,32,0.16)",
    },
  },
];

export function themeCss(t: ThemeDef): string {
  const vars = Object.entries(t.vars)
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  return `:root{${vars}}`;
}

export interface CssSnippet {
  name: string;
  css: string;
}

export const CSS_SNIPPETS: CssSnippet[] = [
  {
    name: "Стекло",
    css: `/* Матовое стекло — размытие и сочность */
.glass, .bg-surface, .bg-panel, .bg-side {
  backdrop-filter: blur(28px) saturate(1.6) !important;
  -webkit-backdrop-filter: blur(28px) saturate(1.6) !important;
}`,
  },
  {
    name: "Неон",
    css: `/* Неоновая подсветка всего интерфейса */
button, .track-cover, input[type="range"] {
  box-shadow: 0 0 18px -6px var(--accent) !important;
}
.eq-bar { filter: drop-shadow(0 0 5px var(--accent)); }`,
  },
  {
    name: "Скрыть исполнителей",
    css: `/* Убрать колонку исполнителей из списка */
.artist-col { display: none !important; }`,
  },
  {
    name: "Круглые обложки",
    css: `/* Обложки как виниловые круги */
.track-cover, .track-cover img { border-radius: 999px !important; }`,
  },
  {
    name: "Винтаж",
    css: `/* Тёплая плёночная картинка */
body { filter: sepia(0.22) saturate(1.08) contrast(0.97); }`,
  },
  {
    name: "Минимализм",
    css: `/* Убрать всё лишнее: шапку, статистику, кнопки */
.app-header { display: none; }
.sidebar-stats, .sidebar-meta { display: none; }
#volume-slider { display: none; }`,
  },
];

export const THEME_VARS = [
  "--accent",
  "--bg-base",
  "--surface",
  "--panel",
  "--overlay",
  "--t1",
  "--t2",
  "--t3",
  "--line",
  "--glass-bg",
  "--glass-strong",
  "--glass-border",
  "--track",
  "--glow-a",
  "--glow-b",
];
