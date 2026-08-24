import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ACCENTS } from "../types";
import { useI18n } from "../lib/i18n";

interface Props {
  accent: string;
  onAccent: (c: string) => void;
}

/** accent (hex или hsl) → [hue 0..360, saturation 0..100] */
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

/** Палитра выбора акцентного цвета: оттенок по X, насыщенность по Y */
export default function AccentPicker({ accent, onAccent }: Props) {
  const { t } = useI18n();
  const padRef = useRef<HTMLDivElement>(null);
  const [h, s] = accentToHS(accent);
  const [dragging, setDragging] = useState(false);

  const selectFromEvent = (e: ReactPointerEvent) => {
    const el = padRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    const hue = Math.round(x * 360);
    const sat = Math.round((1 - y) * 100);
    onAccent(`hsl(${hue}, ${sat}%, ${LIGHTNESS}%)`);
  };

  const onDown = (e: ReactPointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    selectFromEvent(e);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (dragging) selectFromEvent(e);
  };
  const onUp = () => setDragging(false);

  return (
    <div className="w-full">
      {/* палитра: оттенок →, насыщенность ↑ */}
      <div
        ref={padRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative h-[110px] w-full cursor-crosshair touch-none overflow-hidden rounded-2xl border border-white/10"
        style={{
          background:
            "linear-gradient(to top, #ffffff, rgba(255,255,255,0)), linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))",
        }}
        role="slider"
        aria-label={t("accentTitle")}
        aria-valuetext={`${Math.round(h)}°, ${Math.round(s)}%`}
      >
        {/* маркер текущего цвета */}
        <span
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.5)]"
          style={{ left: `${(h / 360) * 100}%`, top: `${(1 - s / 100) * 100}%`, background: accent }}
        />
      </div>

      {/* быстрые пресеты */}
      <div className="mt-2.5 flex items-center gap-2">
        {ACCENTS.map((c) => (
          <button
            key={c}
            onClick={() => onAccent(c)}
            className="h-6 w-6 rounded-full transition-transform hover:scale-110 active:scale-95"
            style={{ background: c, outline: accent.toLowerCase() === c ? "2px solid #fff" : "none", outlineOffset: 2 }}
            aria-label={t("accentTitle")}
          />
        ))}
        <span
          className="ml-auto h-6 w-10 rounded-lg border border-white/15"
          style={{ background: accent }}
          aria-hidden
        />
      </div>
    </div>
  );
}
