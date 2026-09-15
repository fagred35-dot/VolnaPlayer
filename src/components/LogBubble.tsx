import { useEffect, useRef, useState } from "react";
import { appLog, clearLog, formatLogEntry, getLogEntries, subscribeLog } from "../lib/applog";
import { useI18n } from "../lib/i18n";
import { IconTrash, IconX } from "./icons";

const POS_KEY = "volna.log.bubble";

/**
 * Плавающая кнопка лога (только мобильная версия): перетаскивается,
 * тап открывает шторку с журналом приложения — живая диагностика
 * синхронизации, обоев и ошибок JS на устройстве.
 */
export default function LogBubble() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) return JSON.parse(raw) as { x: number; y: number };
    } catch {
      /* ignore */
    }
    return { x: 12, y: Math.round(window.innerHeight * 0.72) };
  });
  const [tick, setTick] = useState(0);
  const drag = useRef<{ sx: number; sy: number; x: number; y: number; moved: boolean } | null>(null);
  const dragEndAt = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => subscribeLog(() => setTick((n) => n + 1)), []);

  /* при открытии — прокрутка вниз, к свежим записям */
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, tick]);

  const savePos = (x: number, y: number) => {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ x, y }));
    } catch {
      /* ignore */
    }
  };

  const clamp = (x: number, y: number) => ({
    x: Math.min(Math.max(4, x), window.innerWidth - 52),
    y: Math.min(Math.max(4, y), window.innerHeight - 52),
  });

  const onTouchStart = (e: React.TouchEvent) => {
    const th = e.touches[0];
    drag.current = { sx: th.clientX, sy: th.clientY, x: pos.x, y: pos.y, moved: false };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current;
    if (!d) return;
    const th = e.touches[0];
    const dx = th.clientX - d.sx;
    const dy = th.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 8) d.moved = true;
    if (d.moved) setPos(clamp(d.x + dx, d.y + dy));
  };
  const onTouchEnd = () => {
    /* жест закончен; открытие — в onClick: призрачный клик после touchend
     * иначе попадает в бэкдроп шторки и мгновенно её закрывает */
    dragEndAt.current = Date.now();
    if (drag.current?.moved) savePos(pos.x, pos.y);
    drag.current = null;
  };
  const onClick = () => {
    if (Date.now() - dragEndAt.current < 400) return; // это был drag, не тап
    setOpen(true);
  };

  const copyAll = async () => {
    const text = getLogEntries()
      .map(formatLogEntry)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      appLog("ui", "log copied");
    } catch {
      /* нет доступа к буферу */
    }
  };

  return (
    <>
      <button
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onClick}
        className="fixed z-[60] flex h-11 w-11 touch-none items-center justify-center rounded-full border border-white/10 bg-black/45 text-[10px] font-extrabold text-white/70 backdrop-blur-md active:bg-black/70"
        style={{ left: pos.x, top: pos.y }}
        aria-label={t("logTitle")}
      >
        LOG
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-label={t("logTitle")}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="volna-sheet bg-panel absolute inset-x-0 bottom-0 flex max-h-[80%] flex-col rounded-t-3xl border-t border-white/10 shadow-2xl">
            <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3">
              <span className="text-xs font-bold uppercase tracking-wider text-white/60">{t("logTitle")}</span>
              <span className="ml-auto" />
              <button
                onClick={() => void copyAll()}
                className="rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-[11px] font-bold text-white/70 transition-colors active:scale-95"
              >
                {t("logCopy")}
              </button>
              <button
                onClick={() => clearLog()}
                className="rounded-lg bg-white/[0.07] p-2 text-white/50 transition-colors active:scale-95"
                aria-label={t("logClear")}
              >
                <IconTrash className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg bg-white/[0.07] p-2 text-white/50 transition-colors active:scale-95"
                aria-label={t("close")}
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
            <div ref={listRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {getLogEntries().length ? (
                <pre className="whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-white/65">
                  {getLogEntries()
                    .map(formatLogEntry)
                    .join("\n")}
                </pre>
              ) : (
                <div className="py-8 text-center text-xs text-white/30">{t("logEmpty")}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
