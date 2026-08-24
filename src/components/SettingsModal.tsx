import { useI18n } from "../lib/i18n";
import AccentPicker from "./AccentPicker";
import { IconChart, IconGlobe, IconMusic, IconPalette, IconSliders, IconX } from "./icons";
import type { Lang } from "../lib/i18n";

interface Props {
  rpcOn: boolean;
  onToggleRpc: () => void;
  accent: string;
  onAccent: (c: string) => void;
  onOpenStats: () => void;
  onOpenThemes: () => void;
  onOpenEq: () => void;
  onOpenCredits: () => void;
  onClose: () => void;
}

/**
 * Шестерёнка настроек: язык, статистика, Discord RPC, темы и стили, эквалайзер.
 * Всё в одном месте, в стиле приложения.
 */
export default function SettingsModal(p: Props) {
  const { t, lang, setLang } = useI18n();
  const row =
    "flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all hover:bg-white/[0.06] active:scale-[0.99]";

  const langBtn = (id: Lang, label: string) => (
    <button
      key={id}
      onClick={() => setLang(id)}
      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
        lang === id ? "bg-[var(--accent)] text-white shadow-[0_3px_12px_-3px_var(--accent)]" : "bg-white/[0.07] text-white/55 hover:bg-white/[0.14] hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) p.onClose();
      }}
    >
      <div
        className="anim-in glass bg-panel w-full max-w-[420px] rounded-3xl p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="font-display text-lg font-bold">{t("settingsTitle")}</div>
            <div className="mt-1 text-xs font-medium text-white/40">{t("settingsSubtitle")}</div>
          </div>
          <button
            onClick={p.onClose}
            className="rounded-xl bg-white/[0.06] p-2 text-white/60 transition-all hover:bg-white/[0.12] hover:text-white active:scale-90"
            aria-label={t("close")}
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1.5">
          {/* Акцентный цвет */}
          <div className={`${row} cursor-default flex-col items-stretch gap-3`}>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                <IconPalette className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-white/90">{t("accentTitle")}</span>
                <span className="block text-[11px] font-medium text-white/35">{t("accentDesc")}</span>
              </span>
            </div>
            <AccentPicker accent={p.accent} onAccent={p.onAccent} />
          </div>

          {/* Язык */}
          <div className={`${row} cursor-default`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
              <IconGlobe className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white/90">{t("languageRowTitle")}</span>
              <span className="block text-[11px] font-medium text-white/35">{t("languageRowDesc")}</span>
            </span>
            <span className="flex shrink-0 gap-1 rounded-xl bg-black/20 p-1">
              {langBtn("en", "EN")}
              {langBtn("ru", "RU")}
            </span>
          </div>

          {/* Темы и стили */}
          <button
            onClick={() => {
              p.onOpenThemes();
              p.onClose();
            }}
            className={row}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
              <IconPalette className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white/90">{t("themesTitle")}</span>
              <span className="block text-[11px] font-medium text-white/35">{t("rowThemesDesc")}</span>
            </span>
            <span className="text-white/25">▸</span>
          </button>

          {/* Эквалайзер */}
          <button
            onClick={() => {
              p.onOpenEq();
              p.onClose();
            }}
            className={row}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
              <IconSliders className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white/90">{t("equalizer")}</span>
              <span className="block text-[11px] font-medium text-white/35">{t("rowEqDesc")}</span>
            </span>
            <span className="text-white/25">▸</span>
          </button>

          {/* Discord RPC */}
          <button onClick={p.onToggleRpc} className={row}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#5865F2]/15 text-[#5865F2]">
              <span className="text-lg leading-none">🎮</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white/90">{t("rpcRowTitle")}</span>
              <span className="block text-[11px] font-medium text-white/35">{t("rpcRowDesc")}</span>
            </span>
            <span
              className={`relative shrink-0 rounded-full transition-colors ${p.rpcOn ? "bg-[#5865F2]" : "bg-white/15"}`}
              style={{ width: 42, height: 24 }}
            >
              <span
                className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all"
                style={{ left: p.rpcOn ? 21 : 3 }}
              />
            </span>
          </button>

          {/* Статистика */}
          <button
            onClick={() => {
              p.onOpenStats();
              p.onClose();
            }}
            className={row}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
              <IconChart className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white/90">{t("statsTitle")}</span>
              <span className="block text-[11px] font-medium text-white/35">{t("rowStatsDesc")}</span>
            </span>
            <span className="text-white/25">▸</span>
          </button>

          {/* О приложении */}
          <button
            onClick={() => {
              p.onOpenCredits();
              p.onClose();
            }}
            className={`${row} opacity-60`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-white/60">
              <IconMusic className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white/90">{t("aboutRowTitle")}</span>
              <span className="block text-[11px] font-medium text-white/35">{t("aboutRowDesc")}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
