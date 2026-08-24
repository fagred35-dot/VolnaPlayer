import { useI18n } from "../lib/i18n";
import { IconTrash, IconX } from "./icons";

interface Props {
  title: string;
  text: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Модальное подтверждение действия (например, удаление файла с диска) */
export default function ConfirmDialog({ title, text, confirmLabel, onConfirm, onCancel }: Props) {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="anim-in glass bg-panel w-full max-w-[380px] rounded-3xl p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
            <IconTrash className="h-5 w-5" />
          </span>
          <button
            onClick={onCancel}
            className="rounded-xl bg-white/[0.06] p-2 text-white/60 transition-all hover:bg-white/[0.12] hover:text-white active:scale-90"
            aria-label={t("close")}
          >
            <IconX className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="font-display mt-3 text-lg font-bold">{title}</div>
        <div className="mt-1.5 break-all text-[13px] font-medium leading-relaxed text-white/50">{text}</div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-white/[0.07] py-2.5 text-sm font-bold text-white/75 transition-colors hover:bg-white/[0.14] hover:text-white active:scale-[0.98]"
          >
            {t("cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
