import type { Toast } from "../types";

export default function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed left-1/2 top-5 z-[80] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-in glass bg-panel flex items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-2xl"
        >
          {t.icon && <span className="text-base leading-none">{t.icon}</span>}
          {t.text}
        </div>
      ))}
    </div>
  );
}
