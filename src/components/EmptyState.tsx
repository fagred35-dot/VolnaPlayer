import { useI18n } from "../lib/i18n";
import { IconFolder, IconPlus } from "./icons";

interface Props {
  onAddFiles: () => void;
  onAddFolder: () => void;
}

export default function EmptyState({ onAddFiles, onAddFolder }: Props) {
  const { t } = useI18n();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6">
      <div className="flex w-full max-w-xl flex-col items-center gap-5 rounded-[2rem] border-2 border-dashed border-white/15 bg-white/[0.02] px-8 py-14 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--accent)]/15 text-4xl">
          🎧
        </div>
        <div>
          <div className="font-display text-xl font-bold">{t("libraryEmpty")}</div>
          <div className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/40">
            {t("libraryEmptyHint")}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={onAddFiles}
            className="flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95"
            style={{
              background: "var(--accent-grad)",
              boxShadow: "0 8px 24px -8px var(--accent)",
            }}
          >
            <IconPlus className="h-4 w-4" strokeWidth={3} />
            {t("pickFiles")}
          </button>
          <button
            onClick={onAddFolder}
            className="glass flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <IconFolder className="h-4 w-4" />
            {t("wholeFolder")}
          </button>
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/25">
          {t("formatsLine")}
        </div>
      </div>
    </div>
  );
}
