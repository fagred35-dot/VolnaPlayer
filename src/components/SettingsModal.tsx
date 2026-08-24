import { useState, type ReactNode } from "react";
import { useI18n } from "../lib/i18n";
import AccentPicker from "./AccentPicker";
import { IconChart, IconGlobe, IconMusic, IconPalette, IconSliders, IconX } from "./icons";
import type { Lang } from "../lib/i18n";

interface Props {
  rpcOn: boolean;
  onToggleRpc: () => void;
  accent: string;
  onAccent: (c: string) => void;
  accent2?: string | null;
  onAccent2?: (c: string | null) => void;
  onOpenStats: () => void;
  onOpenThemes: () => void;
  onOpenEq: () => void;
  onOpenCredits: () => void;
  onClose: () => void;
}

type Tab = "general" | "appearance" | "integrations" | "about";

/**
 * Настройки: слева вкладки (иконка + название), справа — содержимое.
 * Группы: Общие (язык, акцент) · Внешний вид (темы, эквалайзер) ·
 * Интеграции (Discord RPC) · О приложении (статистика, open-source).
 */
export default function SettingsModal(p: Props) {
  const { t, lang, setLang } = useI18n();
  const [tab, setTab] = useState<Tab>("general");

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

  /** ВАЖНО: функция рендера, а не компонент — иначе кнопки пересоздаются
      при каждом рендере (а он случается 60 раз/сек во время музыки)
      и клики по ним не срабатывают. */
  const renderRow = (
    { icon, title, desc, right, onClick, danger }: { icon: ReactNode; title: string; desc?: string; right?: ReactNode; onClick?: () => void; danger?: boolean }
  ): ReactNode => {
    const cls = `${row} ${danger ? "text-red-300/80" : ""}`;
    return onClick ? (
      <button onClick={onClick} className={cls}>
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white/90">{title}</span>
          {desc && <span className="block text-[11px] font-medium text-white/35">{desc}</span>}
        </span>
        {right ?? <span className="text-white/25">▸</span>}
      </button>
    ) : (
      <div className={cls}>
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white/90">{title}</span>
          {desc && <span className="block text-[11px] font-medium text-white/35">{desc}</span>}
        </span>
        {right}
      </div>
    );
  };

  const tabs: Array<{ id: Tab; name: string; icon: typeof IconPalette }> = [
    { id: "general", name: t("setTabGeneral"), icon: IconSliders },
    { id: "appearance", name: t("setTabAppearance"), icon: IconPalette },
    { id: "integrations", name: t("setTabIntegrations"), icon: IconGlobe },
    { id: "about", name: t("setTabAbout"), icon: IconChart },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) p.onClose();
      }}
    >
      <div
        className="anim-in glass bg-panel flex max-h-[80vh] w-full max-w-[620px] rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* левая колонка — вкладки */}
        <div className="flex w-[178px] shrink-0 flex-col rounded-l-3xl bg-black/20 p-4">
          <div className="px-1">
            <div className="font-display text-lg font-bold">{t("settingsTitle")}</div>
            <div className="mt-0.5 text-[10px] font-medium leading-snug text-white/35">{t("settingsSubtitle")}</div>
          </div>
          <div className="mt-4 space-y-1">
            {tabs.map((tb) => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold transition-all ${
                  tab === tb.id
                    ? "bg-[var(--accent)] text-white shadow-[0_4px_14px_-4px_var(--accent)]"
                    : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <tb.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{tb.name}</span>
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button
            onClick={p.onClose}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <IconX className="h-4 w-4 shrink-0" />
            {t("close")}
          </button>
        </div>

        {/* правая колонка — содержимое вкладки */}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
          <div className="min-h-[380px] space-y-1.5">
            {tab === "general" && (
              <>
                {renderRow({
                  icon: (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                      <IconGlobe className="h-4.5 w-4.5" />
                    </span>
                  ),
                  title: t("languageRowTitle"),
                  desc: t("languageRowDesc"),
                  right: (
                    <span className="flex shrink-0 gap-1 rounded-xl bg-black/20 p-1">
                      {langBtn("en", "EN")}
                      {langBtn("ru", "RU")}
                    </span>
                  ),
                })}
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
                  <AccentPicker accent={p.accent} onAccent={p.onAccent} accent2={p.accent2} onAccent2={p.onAccent2} />
                </div>
              </>
            )}

            {tab === "appearance" && (
              <>
                {renderRow({
                  icon: (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                      <IconPalette className="h-4.5 w-4.5" />
                    </span>
                  ),
                  title: t("themesTitle"),
                  desc: t("rowThemesDesc"),
                  onClick: () => {
                    p.onOpenThemes();
                    p.onClose();
                  },
                })}
                {renderRow({
                  icon: (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                      <IconSliders className="h-4.5 w-4.5" />
                    </span>
                  ),
                  title: t("equalizer"),
                  desc: t("rowEqDesc"),
                  onClick: () => {
                    p.onOpenEq();
                    p.onClose();
                  },
                })}
              </>
            )}

            {tab === "integrations" &&
              renderRow({
                icon: (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#5865F2]/15 text-[#5865F2]">
                    <span className="text-lg leading-none">🎮</span>
                  </span>
                ),
                title: t("rpcRowTitle"),
                desc: t("rpcRowDesc"),
                onClick: p.onToggleRpc,
                right: (
                  <span
                    className={`relative shrink-0 rounded-full transition-colors ${p.rpcOn ? "bg-[#5865F2]" : "bg-white/15"}`}
                    style={{ width: 42, height: 24 }}
                  >
                    <span
                      className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all"
                      style={{ left: p.rpcOn ? 21 : 3 }}
                    />
                  </span>
                ),
              })}

            {tab === "about" && (
              <>
                {renderRow({
                  icon: (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                      <IconChart className="h-4.5 w-4.5" />
                    </span>
                  ),
                  title: t("statsTitle"),
                  desc: t("rowStatsDesc"),
                  onClick: () => {
                    p.onOpenStats();
                    p.onClose();
                  },
                })}
                {renderRow({
                  icon: (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-white/60">
                      <IconMusic className="h-4.5 w-4.5" />
                    </span>
                  ),
                  title: t("aboutRowTitle"),
                  desc: t("aboutRowDesc"),
                  onClick: () => {
                    p.onOpenCredits();
                    p.onClose();
                  },
                })}
                <div className="px-4 pt-3 text-center text-[11px] font-medium text-white/25">
                  Волна · 1.3.1 · MIT
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
