import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ACCENTS } from "../types";
import { useI18n } from "../lib/i18n";

interface Props {
  accent: string;
  onAccent: (c: string) => void;
  accent2?: string | null;
  onAccent2?: (c: string | null) => void;
}

/** цвет (hex или hsl) → [hue 0..360, saturation 0..100] */
function accentToHS(accent: string): [number, number] {
  const hsl = /hsl\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%/.exec(accent);
  if (hsl) return [Number(hsl[1]) % 360, Number(hsl[2])];
  const hex = /^#?([0-9a-f]{6})$/i.exec(accent.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : (d / max) * 100;
    return [h, s];
  }
  return [262, 83];
}

const LIGHTNESS = 55;

const GRADIENT_PRESETS: Array<[string, string]> = [
  ["#8b5cf6", "#22d3ee"],
  ["#fb7185", "#f59e0b"],
  ["#34d399", "#8b5cf6"],
  ["#22d3ee", "#fb7185"],
  ["#f59e0b", "#ef4444"],
  ["#a78bfa", "#f472b6"],
];

/** Палитра: оттенок по X, насыщенность по Y (вниз — в белый) */
function Pad({ color, onPick, label }: { color: string; onPick: (hsl: string) => void; label: string }) {
  const padRef = useRef<HTMLDivElement>(null);
  const [h, s] = accentToHS(color);
  const [dragging, setDragging] = useState(false);

  const select = (e: ReactPointerEvent) => {
    const el = padRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    onPick(`hsl(${Math.round(x * 360)}, ${Math.round((1 - y) * 100)}%, ${LIGHTNESS}%)`);
  };

  return (
    <div
      ref={padRef}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setDragging(true);
        select(e);
      }}
      onPointerMove={(e) => dragging && select(e)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      className="relative h-[92px] w-full cursor-crosshair touch-none overflow-hidden rounded-2xl border border-white/10"
      style={{
        background:
          "linear-gradient(to top, #ffffff, rgba(255,255,255,0)), linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))",
      }}
      role="slider"
      aria-label={label}
      aria-valuetext={`${Math.round(h)}°, ${Math.round(s)}%`}
    >
      <span
        className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.5)]"
        style={{ left: `${(h / 360) * 100}%`, top: `${(1 - s / 100) * 100}%`, background: color }}
      />
    </div>
  );
}

/** Выбор акцента: одиночный цвет или градиент из двух цветов */
export default function AccentPicker({ accent, onAccent, accent2, onAccent2 }: Props) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"solid" | "gradient">(accent2 ? "gradient" : "solid");

  const segBtn = (id: "solid" | "gradient", label: string) => (
    <button
      key={id}
      onClick={() => setMode(id)}
      className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
        mode === id ? "bg-[var(--accent)] text-white shadow-[0_3px_12px_-3px_var(--accent)]" : "text-white/55 hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full">
      {/* режим: цвет / градиент */}
      <div className="mb-2.5 flex gap-1 rounded-xl bg-black/25 p-1">
        {segBtn("solid", t("accentModeSolid"))}
        {segBtn("gradient", t("accentModeGradient"))}
      </div>

      {mode === "solid" ? (
        <Pad color={accent} onPick={onAccent} label={t("accentTitle")} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Pad color={accent} onPick={onAccent} label="A" />
            <Pad color={accent2 ?? accent} onPick={(c) => onAccent2?.(c)} label="B" />
          </div>
          {/* превью градиента */}
          <div
            className="mt-2 h-5 w-full rounded-lg border border-white/10"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent2 ?? accent})` }}
          />
          {accent2 && onAccent2 && (
            <button
              onClick={() => onAccent2(null)}
              className="mt-1.5 w-full rounded-lg bg-white/[0.07] py-1.5 text-[11px] font-bold text-white/50 transition-colors hover:bg-white/[0.14] hover:text-white"
            >
              {t("accentNoGradient")}
            </button>
          )}
        </>
      )}

      {/* быстрые пресеты */}
      <div className="mt-2.5 flex items-center gap-2">
        {ACCENTS.map((c) => (
          <button
            key={c}
            onClick={() => {
              onAccent(c);
              onAccent2?.(null);
              setMode("solid");
            }}
            className="h-6 w-6 rounded-full transition-transform hover:scale-110 active:scale-95"
            style={{ background: c, outline: accent.toLowerCase() === c && !accent2 ? "2px solid #fff" : "none", outlineOffset: 2 }}
            aria-label={t("accentTitle")}
          />
        ))}
        {/* пресеты градиентов */}
        {GRADIENT_PRESETS.map(([a, b]) => (
          <button
            key={a + b}
            onClick={() => {
              onAccent(a);
              onAccent2?.(b);
              setMode("gradient");
            }}
            className="h-6 w-6 rounded-full transition-transform hover:scale-110 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${a}, ${b})`,
              outline: accent2?.toLowerCase() === b.toLowerCase() && accent.toLowerCase() === a.toLowerCase() ? "2px solid #fff" : "none",
              outlineOffset: 2,
            }}
            aria-label={`${a} → ${b}`}
          />
        ))}
        <span className="ml-auto h-6 w-10 rounded-lg border border-white/15" style={{ background: "var(--accent-grad)" }} aria-hidden />
      </div>
    </div>
  );
}
