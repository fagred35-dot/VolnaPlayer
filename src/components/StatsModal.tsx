import type { Track } from "../types";
import { formatTotal } from "../lib/format";
import { formatDate, useI18n } from "../lib/i18n";
import type { TrackStat } from "../hooks/useStats";
import TrackCover from "./TrackCover";
import { IconChart, IconX } from "./icons";

interface Props {
  stats: Record<string, TrackStat>;
  tracks: Track[];
  onClose: () => void;
}

export default function StatsModal({ stats, tracks, onClose }: Props) {
  const { t, lang } = useI18n();
  const byId = new Map(tracks.map((tr) => [tr.id, tr]));
  const entries = Object.entries(stats).filter(([, s]) => s.count > 0);
  const totalPlays = entries.reduce((a, [, s]) => a + s.count, 0);
  const totalMs = entries.reduce((a, [, s]) => a + s.listened, 0);
  const favCount = tracks.filter((tr) => tr.fav).length;

  const top = [...entries].sort((a, b) => b[1].count - a[1].count).slice(0, 5);
  const recent = [...entries].sort((a, b) => b[1].lastPlayed - a[1].lastPlayed).slice(0, 10);

  const card = "rounded-2xl bg-white/[0.045] p-3.5";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="anim-in glass bg-panel flex max-h-[86vh] w-full max-w-[520px] flex-col rounded-3xl p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
              <IconChart className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-lg font-bold">{t("statsTitle")}</div>
              <div className="text-xs font-medium text-white/40">{t("statsSubtitle")}</div>
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

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="text-4xl">📊</div>
            <div className="text-sm font-bold text-white/70">{t("statsEmpty")}</div>
            <div className="max-w-[260px] text-xs leading-relaxed text-white/35">{t("statsEmptyHint")}</div>
          </div>
        ) : (
          <div className="scroll-thin flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2.5">
              <div className={card}>
                <div className="font-display text-2xl font-bold text-[var(--accent)]">{totalPlays}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-white/40">{t("statPlays")}</div>
              </div>
              <div className={card}>
                <div className="font-display text-2xl font-bold text-[var(--accent)]">{formatTotal(totalMs / 1000, lang)}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-white/40">{t("statListeningTime")}</div>
              </div>
              <div className={card}>
                <div className="font-display text-2xl font-bold">{tracks.length}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-white/40">{t("statInLibrary")}</div>
              </div>
              <div className={card}>
                <div className="font-display text-2xl font-bold">{favCount}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-white/40">{t("statFavorites")}</div>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
                {t("statsMostPlayed")}
              </div>
              <div className="space-y-1">
                {top.map(([id, s]) => {
                  const tr = byId.get(id);
                  if (!tr) return null;
                  return (
                    <div key={id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.04]">
                      <TrackCover track={tr} className="h-9 w-9 rounded-lg text-sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white/85">{tr.title}</div>
                        <div className="truncate text-xs text-white/40">{tr.artist || t("unknownArtist")}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-[var(--accent)]">{s.count}×</div>
                        <div className="text-[10px] font-semibold text-white/30">{formatTotal(s.listened / 1000, lang)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 pb-2">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
                {t("statsRecent")}
              </div>
              <div className="space-y-1">
                {recent.map(([id, s]) => {
                  const tr = byId.get(id);
                  if (!tr) return null;
                  return (
                    <div key={id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.04]">
                      <TrackCover track={tr} className="h-9 w-9 rounded-lg text-sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white/85">{tr.title}</div>
                        <div className="truncate text-xs text-white/40">{tr.artist || t("unknownArtist")}</div>
                      </div>
                      <span className="text-[11px] font-semibold text-white/30">{formatDate(lang, s.lastPlayed)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
