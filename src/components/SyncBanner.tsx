import { IconPc, IconPhone, IconSync, IconX } from "./icons";
import type { SyncCandidate } from "../hooks/useSync";
import { useI18n } from "../lib/i18n";

interface Props {
  candidate: SyncCandidate | null;
  onConnect: (c: SyncCandidate) => void;
  onDismiss: () => void;
}

/** Баннер «Найдено устройство в сети» — по центру сверху */
export default function SyncBanner({ candidate, onConnect, onDismiss }: Props) {
  const { t } = useI18n();
  if (!candidate) return null;
  const Icon = candidate.type === "pc" ? IconPc : IconPhone;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-3 sm:top-5">
      <div className="volna-fade bg-panel pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-[var(--accent)]/30 p-3.5 pr-2.5 shadow-2xl backdrop-blur-2xl">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
            <IconSync className="h-3 w-3" />
            {t("syncBannerTitle")}
          </div>
          <div className="truncate text-sm font-bold text-white">{candidate.name}</div>
          <div className="text-[11px] font-medium text-white/40">
            {candidate.type === "pc" ? t("syncTypePc") : t("syncTypePhone")} · {candidate.ip}
          </div>
        </div>
        <button
          onClick={() => onConnect(candidate)}
          className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white transition-transform hover:brightness-110 active:scale-95"
        >
          {t("syncConnect")}
        </button>
        <button
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-2 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white"
          aria-label={t("syncDismiss")}
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
