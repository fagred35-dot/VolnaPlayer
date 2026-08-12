import { EQ_FREQS, EQ_PRESETS, type EqState } from "../types";
import { IconX } from "./icons";

interface Props {
  eq: EqState;
  onToggle: () => void;
  onChange: (i: number, v: number) => void;
  onPreset: (name: string, gains: number[]) => void;
  onClose: () => void;
}

export default function Equalizer({ eq, onToggle, onChange, onPreset, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="anim-in glass bg-panel w-full max-w-[780px] rounded-3xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="font-display text-lg font-bold">Эквалайзер</div>
            <div className="mt-1 text-xs font-medium text-white/40">10 полос · Web Audio API · 0% CPU в паузе</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onToggle}
              className={`relative h-7 w-13 rounded-full transition-colors ${eq.enabled ? "bg-[var(--accent)]" : "bg-white/15"}`}
              style={{ width: 52 }}
              aria-label="Вкл/выкл"
            >
              <span
                className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all"
                style={{ left: eq.enabled ? 26 : 4 }}
              />
            </button>
            <button
              onClick={onClose}
              className="rounded-xl bg-white/[0.06] p-2 text-white/60 transition-all hover:bg-white/[0.12] hover:text-white active:scale-90"
              aria-label="Закрыть"
            >
              <IconX className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Пресеты */}
        <div className="scroll-thin -mx-2 mb-6 flex gap-2 overflow-x-auto px-2 pb-1">
          {EQ_PRESETS.map((pr) => (
            <button
              key={pr.name}
              onClick={() => onPreset(pr.name, pr.gains)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                eq.preset === pr.name
                  ? "bg-[var(--accent)] text-white shadow-[0_4px_16px_-4px_var(--accent)]"
                  : "bg-white/[0.06] text-white/55 hover:bg-white/[0.1] hover:text-white"
              }`}
            >
              {pr.name}
            </button>
          ))}
        </div>

        {/* Слайдеры */}
        <div className="flex items-end justify-between gap-2">
          {eq.gains.map((g, i) => (
            <div key={EQ_FREQS[i]} className="flex flex-1 flex-col items-center gap-2">
              <span className={`text-[10px] font-bold tabular-nums ${g === 0 ? "text-white/25" : "text-[var(--accent)]"}`}>
                {g > 0 ? "+" : ""}
                {g.toFixed(0)}
              </span>
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={g}
                onChange={(e) => onChange(i, Number(e.target.value))}
                className="vslider"
                aria-label={`Полоса ${EQ_FREQS[i]} Гц`}
              />
              <span className="text-[10px] font-bold text-white/35">
                {EQ_FREQS[i] >= 1000 ? `${EQ_FREQS[i] / 1000}к` : EQ_FREQS[i]}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between text-[11px] font-medium text-white/30">
          <span>{eq.enabled ? "Эквалайзер активен" : "Эквалайзер выключен — звук идёт напрямую"}</span>
          <span>{eq.preset}</span>
        </div>
      </div>
    </div>
  );
}
