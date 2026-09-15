import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "../lib/i18n";
import AccentPicker from "./AccentPicker";
import { IconChart, IconGlobe, IconImage, IconPalette, IconSliders, IconX } from "./icons";
import type { Lang } from "../lib/i18n";
import type { McpInfo } from "../electron.d";
import { isMobilePlatform } from "../lib/platform";
import { OSS_PROJECTS } from "./CreditsModal";
import type { WallpaperBlur, WallpaperTarget } from "../hooks/useCoverWallpaper";

/** Копирование в буфер с fallback для окружений без Clipboard API */
function copyToClipboard(text: string, onDone: () => void) {
  const fallback = () => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      onDone();
    } catch {
      /* не смогли — не смогли */
    }
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(onDone).catch(fallback);
  else fallback();
}

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
  /** версия сборки (runtime) */
  version?: string;
  /** обои из обложки (Android): цель + сила размытия */
  osWallpaperTarget: WallpaperTarget;
  onOsWallpaperTarget: (t: WallpaperTarget) => void;
  osWallpaperBlur: WallpaperBlur;
  onOsWallpaperBlur: (b: WallpaperBlur) => void;
  /** плавающая кнопка журнала (Android): лог под рукой для диагностики */
  logPanel: boolean;
  onLogPanel: (v: boolean) => void;
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
  const [mcpOpen, setMcpOpen] = useState(false);
  const [mcpInfo, setMcpInfo] = useState<McpInfo | null>(null);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [wpOpen, setWpOpen] = useState(false);
  const [crashText, setCrashText] = useState("");

  /* пока панель MCP открыта — раз в 2 с перечитываем порт (сервер мог стартовать) */
  useEffect(() => {
    if (!mcpOpen || !window.volna) return;
    let alive = true;
    const pull = () => window.volna!.getMcpInfo().then((info) => alive && setMcpInfo(info)).catch(() => undefined);
    pull();
    const id = setInterval(pull, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [mcpOpen]);

  /* последний нативный сбой — читаем при открытии вкладки «О приложении» (Android) */
  useEffect(() => {
    if (tab !== "about" || !isMobilePlatform()) return;
    window.volna
      ?.getCrashLog?.()
      .then((r) => setCrashText(r?.text ?? ""))
      .catch(() => setCrashText(""));
  }, [tab]);

  const copyText = (text: string, tag: string) => {
    copyToClipboard(text, () => {
      setCopiedTag(tag);
      setTimeout(() => setCopiedTag((c) => (c === tag ? null : c)), 1600);
    });
  };

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
    // на телефонах интеграций (Discord RPC, MCP) нет — вкладка не нужна
    ...(isMobilePlatform() ? [] : [{ id: "integrations" as Tab, name: t("setTabIntegrations"), icon: IconGlobe }]),
    { id: "about", name: t("setTabAbout"), icon: IconChart },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) p.onClose();
      }}
    >
      <div
        className="anim-in glass bg-panel flex h-full max-h-none w-full max-w-[620px] flex-col overflow-hidden rounded-none shadow-2xl sm:h-auto sm:max-h-[85vh] md:max-h-[80vh] md:flex-row md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* левая колонка — вкладки (на телефоне: шапка + горизонтальный ряд) */}
        <div className="flex shrink-0 flex-col bg-black/20 px-3 py-3 md:w-[178px] md:rounded-l-3xl md:p-4">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 md:px-1">
              <div className="truncate font-display text-base font-bold md:text-lg">{t("settingsTitle")}</div>
              <div className="mt-0.5 hidden text-[10px] font-medium leading-snug text-white/35 md:block">{t("settingsSubtitle")}</div>
            </div>
            <button
              onClick={p.onClose}
              className="rounded-xl bg-white/[0.06] p-2 text-white/60 transition-all active:scale-90 md:hidden"
              aria-label={t("close")}
            >
              <IconX className="h-4.5 w-4.5" />
            </button>
          </div>
          <div className="scroll-thin mt-2 flex gap-1 overflow-x-auto md:mt-4 md:block md:space-y-1">
            {tabs.map((tb) => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-left text-[13px] font-bold transition-all md:w-full md:py-2.5 ${
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
          <div className="hidden flex-1 md:block" />
          <button
            onClick={p.onClose}
            className="hidden items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white md:flex"
          >
            <IconX className="h-4 w-4 shrink-0" />
            {t("close")}
          </button>
        </div>

        {/* правая колонка — содержимое вкладки */}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
          <div className="md:min-h-[380px] space-y-1.5">
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
                {isMobilePlatform() &&
                  renderRow({
                    icon: (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                        <IconImage className="h-4.5 w-4.5" />
                      </span>
                    ),
                    title: t("osWallpaperTitle"),
                    desc: t("osWallpaperDesc"),
                    onClick: () => setWpOpen((o) => !o),
                    right: (
                      <span className="shrink-0 text-[11px] font-bold text-white/35">
                        {p.osWallpaperTarget === "off" ? t("osWallpaperOptOff") : t("osWallpaperOn")}
                        {wpOpen ? " ▾" : " ▸"}
                      </span>
                    ),
                  })}
                {isMobilePlatform() && wpOpen && (
                  <div className="mx-2 mb-1 space-y-3 rounded-2xl bg-black/25 p-4">
                    <div>
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/35">{t("osWallpaperTarget")}</div>
                      <div className="flex flex-wrap gap-1">
                        {(
                          [
                            ["off", t("osWallpaperOptOff")],
                            ["system", t("osWallpaperOptSystem")],
                            ["lock", t("osWallpaperOptLock")],
                            ["both", t("osWallpaperOptBoth")],
                          ] as Array<[WallpaperTarget, string]>
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            onClick={() => p.onOsWallpaperTarget(id)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                              p.osWallpaperTarget === id
                                ? "bg-[var(--accent)] text-white shadow-[0_3px_12px_-3px_var(--accent)]"
                                : "bg-white/[0.07] text-white/55 hover:bg-white/[0.14] hover:text-white"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/35">{t("osWallpaperBlur")}</div>
                      <div className="flex flex-wrap gap-1">
                        {(
                          [
                            ["off", t("osWallpaperOptOff")],
                            ["low", t("osWallpaperBlurLow")],
                            ["mid", t("osWallpaperBlurMid")],
                            ["high", t("osWallpaperBlurHigh")],
                          ] as Array<[WallpaperBlur, string]>
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            onClick={() => p.onOsWallpaperBlur(id)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                              p.osWallpaperBlur === id
                                ? "bg-[var(--accent)] text-white shadow-[0_3px_12px_-3px_var(--accent)]"
                                : "bg-white/[0.07] text-white/55 hover:bg-white/[0.14] hover:text-white"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] font-medium leading-snug text-white/35">{t("osWallpaperNote")}</p>
                  </div>
                )}

                {isMobilePlatform() &&
                  renderRow({
                    icon: (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-lg leading-none">
                        📝
                      </span>
                    ),
                    title: t("logPanelRow"),
                    desc: t("logPanelDesc"),
                    onClick: () => p.onLogPanel(!p.logPanel),
                    right: (
                      <span
                        className={`relative shrink-0 rounded-full transition-colors ${p.logPanel ? "bg-[var(--accent)]" : "bg-white/15"}`}
                        style={{ width: 42, height: 24 }}
                      >
                        <span
                          className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all"
                          style={{ left: p.logPanel ? 21 : 3 }}
                        />
                      </span>
                    ),
                  })}
              </>
            )}

            {tab === "integrations" && (
              <>
                {renderRow({
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
                {renderRow({
                  icon: (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                      <span className="text-lg leading-none">🤖</span>
                    </span>
                  ),
                  title: t("mcpRowTitle"),
                  desc: t("mcpRowDesc"),
                  onClick: () => setMcpOpen((o) => !o),
                  right: <span className="shrink-0 text-white/25">{mcpOpen ? "▾" : "▸"}</span>,
                })}
                {mcpOpen && (
                  <div className="mx-2 mb-1 space-y-3 rounded-2xl bg-black/25 p-4">
                    {!window.volna ? (
                      <div className="text-[12px] font-medium text-white/45">{t("mcpUnavailable")}</div>
                    ) : (
                      <>
                        {/* статус сервера */}
                        <div className="flex items-center gap-2 text-[12px] font-semibold">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              !mcpInfo ? "bg-amber-400" : !mcpInfo.enabled || !mcpInfo.port ? "bg-white/25" : "bg-emerald-400"
                            }`}
                          />
                          <span className="text-white/70">
                            {!mcpInfo ? t("mcpStarting") : !mcpInfo.enabled ? t("mcpOff") : mcpInfo.port ? t("mcpRunning") : t("mcpStarting")}
                          </span>
                          {mcpInfo?.port ? (
                            <span className="ml-auto font-mono text-[11px] text-white/40">:{mcpInfo.port}</span>
                          ) : null}
                        </div>

                        {/* endpoint */}
                        {mcpInfo?.port ? (
                          <div>
                            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/35">{t("mcpEndpoint")}</div>
                            <div className="flex items-center gap-2">
                              <code dir="ltr" className="min-w-0 flex-1 truncate rounded-lg bg-black/30 px-3 py-2 font-mono text-[11px] text-white/75">
                                http://127.0.0.1:{mcpInfo.port}/mcp
                              </code>
                              <button
                                onClick={() => copyText(`http://127.0.0.1:${mcpInfo.port}/mcp`, "endpoint")}
                                className="shrink-0 rounded-lg bg-white/[0.08] px-3 py-2 text-[11px] font-bold text-white/70 transition-colors hover:bg-white/[0.16] hover:text-white"
                              >
                                {copiedTag === "endpoint" ? t("mcpCopied") : t("mcpCopy")}
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {/* готовый конфиг для ИИ-клиента */}
                        {mcpInfo ? (
                          <div>
                            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/35">{t("mcpConfigTitle")}</div>
                            <pre
                              dir="ltr"
                              className="scroll-thin max-h-40 overflow-auto rounded-lg bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-white/75"
                            >
                              {mcpInfo.config}
                            </pre>
                            <button
                              onClick={() => copyText(mcpInfo.config, "config")}
                              className="mt-2 w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-[12px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99]"
                              style={{ boxShadow: "0 4px 14px -6px var(--accent)" }}
                            >
                              {copiedTag === "config" ? t("mcpCopied") : t("mcpCopy")}
                            </button>
                            <p className="mt-2 text-[11px] font-medium leading-snug text-white/35">{t("mcpHint")}</p>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                )}
              </>
            )}

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
                {isMobilePlatform() && crashText && (
                  <div className="rounded-2xl px-4 py-3">
                    <div className="text-sm font-bold text-red-300/90">{t("crashRowTitle")}</div>
                    <pre
                      dir="ltr"
                      className="scroll-thin mt-2 max-h-36 overflow-auto rounded-lg bg-black/30 p-3 font-mono text-[10.5px] leading-relaxed text-white/70"
                    >
                      {crashText}
                    </pre>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => copyText(crashText, "crash")}
                        className="flex-1 rounded-lg bg-white/[0.08] px-3 py-2 text-[11px] font-bold text-white/70 transition-colors hover:bg-white/[0.16] hover:text-white"
                      >
                        {copiedTag === "crash" ? t("mcpCopied") : t("mcpCopy")}
                      </button>
                      <button
                        onClick={() => {
                          window.volna
                            ?.clearCrashLog?.()
                            .then(() => setCrashText(""))
                            .catch(() => undefined);
                        }}
                        className="flex-1 rounded-lg bg-white/[0.08] px-3 py-2 text-[11px] font-bold text-white/70 transition-colors hover:bg-white/[0.16] hover:text-white"
                      >
                        {t("crashClear")}
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] font-medium leading-snug text-white/35">{t("crashRowDesc")}</p>
                  </div>
                )}
                <div className="rounded-2xl px-4 py-3">
                  <div className="text-sm font-bold text-white/90">{t("creditsTitle")}</div>
                  <div className="mt-2 space-y-0.5">
                    {OSS_PROJECTS.map((p2) => (
                      <a
                        key={p2.name}
                        href={p2.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.05]"
                      >
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-white/70 transition-colors group-hover:text-[var(--accent)]">
                          {p2.name}
                        </span>
                        <span className="shrink-0 text-[10px] font-bold text-white/25">{p2.license}</span>
                        <span className="shrink-0 text-[10px] font-bold text-white/25 transition-colors group-hover:text-[var(--accent)]">↗</span>
                      </a>
                    ))}
                  </div>
                </div>
                <div className="px-4 pt-3 text-center text-[11px] font-medium text-white/25">
                  {t("appName")}
                  {p.version ? ` · v${p.version}` : ""} · MIT
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
