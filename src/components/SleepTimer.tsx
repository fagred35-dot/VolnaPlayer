import { useEffect, useState } from "react";
import { formatTime } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { IconMoon, IconX } from "./icons";

interface Props {
  end: number | null;
  onSet: (minutes: number) => void;
  onCancel: () => void;
  onClose: () => void;
}

const OPTIONS = [10, 20, 30, 45, 60, 90];

export default function SleepTimer({ end, onSet, onCancel, onClose }: Props) {
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now());
  const [custom, setCustom] = useState("");
  const customMin = Math.round(Number(custom));
  const customValid = Number.isFinite(customMin) && customMin >= 1 && customMin <= 720;

  const submitCustom = () => {
    if (!customValid) return;
    onSet(customMin);
    setCustom("");
  };

  useEffect(() => {
    if (end === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [end]);

  const left = end !== null ? Math.max(0, end - now) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="anim-in glass bg-panel w-full max-w-[400px] rounded-3xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
              <IconMoon className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-lg font-bold">{t("sleepTimer")}</div>
              <div className="text-xs font-medium text-white/40">{t("stSubtitle")}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/[0.06] p-2 text-white/60 transition-all hover:bg-white/[0.12] hover:text-white active:scale-90"
            aria-label={t("close")}
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        {left !== null ? (
          <div className="rounded-2xl bg-white/[0.05] p-5 text-center">
            <div className="font-display text-4xl font-bold text-[var(--accent)]">{formatTime(Math.ceil(left / 1000))}</div>
            <div className="mt-1 text-xs font-semibold text-white/40">{t("stUntilStop")}</div>
            <button
              onClick={onCancel}
              className="mt-4 w-full rounded-xl bg-white/[0.08] py-2.5 text-sm font-bold text-white/80 transition-colors hover:bg-red-500/20 hover:text-red-300 active:scale-[0.98]"
            >
              {t("stCancelTimer")}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => onSet(m)}
                  className="rounded-2xl bg-white/[0.05] py-3.5 text-sm font-bold text-white/75 transition-all hover:bg-[var(--accent)]/20 hover:text-white active:scale-95"
                >
                  {t("stMinutes", { m })}
                </button>
              ))}
            </div>

            {/* произвольное время руками */}
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                min={1}
                max={720}
                inputMode="numeric"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitCustom()}
                placeholder={t("stCustomPlaceholder")}
                autoFocus
                className={`w-full rounded-xl border bg-black/25 px-3.5 py-2.5 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]/60 ${
                  custom && !customValid ? "border-red-400/70" : "border-white/10"
                }`}
              />
              <button
                onClick={submitCustom}
                disabled={!customValid}
                className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95 disabled:cursor-default disabled:opacity-40"
              >
                {t("apply")}
              </button>
            </div>
            {custom && !customValid && (
              <div className="mt-1.5 px-1 text-[11px] font-bold text-red-400">{t("stCustomRange")}</div>
            )}

            <p className="mt-4 text-center text-[11px] font-medium leading-relaxed text-white/30">
              {t("stNote")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
