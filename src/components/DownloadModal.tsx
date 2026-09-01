import { useRef, useState } from "react";
import type { DlSearchResult } from "../electron.d";
import { useI18n } from "../lib/i18n";
import { formatTime } from "../lib/format";
import type { DlItem } from "../hooks/useDownloadQueue";
import {
  IconDownload,
  IconFolder,
  IconMusic,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconX,
} from "./icons";

interface Props {
  onClose: () => void;
  destDir: string;
  queue: DlItem[];
  onAddUrl: (url: string) => boolean;
  onAddResult: (r: DlSearchResult) => void;
  onCancelActive: () => void;
  onRetry: (id: number) => void;
  onRemoveItem: (id: number) => void;
  onClearFinished: () => void;
}

type Tab = "link" | "search";

/** Миниатюра с заглушкой, если картинка не загрузилась */
function Thumb({ src, size }: { src: string | null; size: string }) {
  const [broken, setBroken] = useState(false);
  const ok = src && !broken;
  return (
    <div
      className={`${size} relative shrink-0 overflow-hidden rounded-lg bg-white/[0.06]`}
    >
      {ok ? (
        <img
          src={src as string}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-white/30">
          <IconMusic className="h-[60%] w-[60%]" />
        </span>
      )}
    </div>
  );
}

/**
 * Скачивание музыки через yt-dlp: по ссылке или поиском на YouTube.
 * Очередь живёт в App (useDownloadQueue) — скачивания идут по одному
 * и не прерываются при закрытии окна.
 */
export default function DownloadModal(p: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("link");
  const [url, setUrl] = useState("");
  const [dupWarn, setDupWarn] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DlSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const waitingCount = p.queue.filter((i) => i.state === "waiting").length;
  const finishedCount = p.queue.filter(
    (i) => i.state === "done" || i.state === "error" || i.state === "cancelled"
  ).length;

  const doSearch = async () => {
    const q = query.trim();
    if (!q || !window.volna?.dlSearch) return;
    setSearching(true);
    setSearchError("");
    try {
      const r = await window.volna.dlSearch(q);
      setResults(r);
      setSearchedQuery(q);
    } catch {
      setResults([]);
      setSearchError(t("searchFailed"));
    } finally {
      setSearching(false);
    }
  };

  const addUrl = () => {
    if (!url.trim()) return;
    const added = p.onAddUrl(url.trim());
    if (added) {
      setUrl("");
      setDupWarn(false);
    } else {
      setDupWarn(true);
    }
  };

  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all ${
        tab === id ? "bg-[var(--accent)] text-white shadow-[0_4px_14px_-4px_var(--accent)]" : "text-white/50 hover:text-white"
      }`}
    >
      {id === "link" ? <IconDownload className="h-3.5 w-3.5" /> : <IconSearch className="h-3.5 w-3.5" />}
      {label}
    </button>
  );

  /* ---------- карточка элемента очереди ---------- */
  const renderItem = (item: DlItem) => {
    const active = item.state === "downloading";
    return (
      <div
        key={item.id}
        className={`relative overflow-hidden rounded-xl bg-white/[0.04] px-2.5 py-2 transition-colors ${
          active ? "bg-white/[0.06]" : ""
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Thumb src={item.thumb} size="h-11 w-11" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-white/90">{item.title}</div>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-white/35">
              {item.channel && <span className="truncate">{item.channel}</span>}
              {item.channel && item.duration > 0 && <span>·</span>}
              {item.duration > 0 && <span className="shrink-0 tabular-nums">{formatTime(item.duration)}</span>}
            </div>
            {/* статусная строка */}
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">
              {active && (
                <span className="text-[var(--accent)]">
                  {item.status || t("statusDownloading")} · {Math.round(item.percent * 100)}%
                </span>
              )}
              {item.state === "waiting" && <span className="text-white/30">{t("statusWaiting")}</span>}
              {item.state === "done" && item.path && <span className="text-emerald-400">✓</span>}
              {item.state === "cancelled" && <span className="text-white/30">{t("statusCancelled")}</span>}
              {item.state === "error" && (
                <span className="text-red-400" title={item.error}>
                  {t("dlErrorGeneric")}
                </span>
              )}
            </div>
          </div>

          {/* правые кнопки по состоянию */}
          <div className="flex shrink-0 items-center gap-1">
            {active && (
              <button
                onClick={p.onCancelActive}
                className="rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-[11px] font-bold text-white/60 transition-colors hover:bg-red-500/15 hover:text-red-300"
              >
                {t("cancel")}
              </button>
            )}
            {item.state === "waiting" && (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/15 border-t-[var(--accent)] opacity-60" />
                <button
                  onClick={() => p.onRemoveItem(item.id)}
                  className="rounded-lg p-1.5 text-white/25 transition-colors hover:text-red-400"
                  aria-label={t("remove")}
                >
                  <IconX className="h-4 w-4" />
                </button>
              </>
            )}
            {(item.state === "error" || item.state === "cancelled") && (
              <>
                <button
                  onClick={() => p.onRetry(item.id)}
                  className="rounded-lg bg-white/[0.07] px-2 py-1.5 text-white/60 transition-colors hover:bg-white/[0.14] hover:text-white"
                  aria-label={t("retry")}
                  title={t("retry")}
                >
                  <IconRefresh className="h-4 w-4" />
                </button>
                <button
                  onClick={() => p.onRemoveItem(item.id)}
                  className="rounded-lg p-1.5 text-white/25 transition-colors hover:text-red-400"
                  aria-label={t("remove")}
                >
                  <IconX className="h-4 w-4" />
                </button>
              </>
            )}
            {item.state === "done" && item.path && (
              <>
                <button
                  onClick={() => window.volna?.openInExplorer(item.path!)}
                  className="rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-[11px] font-bold text-white/60 transition-colors hover:bg-white/[0.14] hover:text-white"
                >
                  <IconFolder className="mr-1 inline h-3.5 w-3.5" />
                  {t("openFolder")}
                </button>
                <button
                  onClick={() => p.onRemoveItem(item.id)}
                  className="rounded-lg p-1.5 text-white/25 transition-colors hover:text-red-400"
                  aria-label={t("remove")}
                >
                  <IconX className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* прогресс поверх нижней грани карточки */}
        {active && (
          <div className="absolute bottom-0 left-0 h-[3px] w-full bg-white/[0.06]">
            <div
              className="h-full rounded-r-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${Math.max(3, Math.round(item.percent * 100))}%` }}
            />
          </div>
        )}

        {/* куда сохранилось */}
        {item.state === "done" && item.path && (
          <div className="mt-1.5 break-all rounded-lg bg-black/20 px-2 py-1 font-mono text-[10px] leading-relaxed text-white/35">
            📁 {item.path}
          </div>
        )}
        {item.state === "error" && item.error && (
          <ErrorBox error={item.error} />
        )}
      </div>
    );
  };

  const queueSection = (
    <div className="mt-4 min-h-0 flex-1 flex flex-col">
      <div className="mb-1.5 flex shrink-0 items-center justify-between px-0.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">
          {waitingCount > 0 ? t("queueCountLabel", { n: waitingCount }) : t("queueTitle")}
        </span>
        {finishedCount > 0 && (
          <button
            onClick={p.onClearFinished}
            className="rounded-md bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-white/45 transition-colors hover:bg-white/[0.12] hover:text-white"
          >
            {t("clearQueue")}
          </button>
        )}
      </div>
      <div className="scroll-thin max-h-[228px] min-h-[64px] space-y-1.5 overflow-y-auto pr-1">
        {p.queue.length === 0 ? (
          <div className="flex h-full min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/10 py-4 text-center">
            <span className="text-xl opacity-40">⬇️</span>
            <span className="text-xs font-semibold text-white/30">{t("statusWaiting")}</span>
          </div>
        ) : (
          p.queue.map(renderItem)
        )}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) p.onClose();
      }}
    >
      <div
        className="anim-in glass bg-panel flex max-h-[88vh] w-full max-w-[500px] flex-col rounded-3xl p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* шапка */}
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
              <IconDownload className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-lg font-bold">{t("dlTitle")}</div>
              <div className="text-xs font-medium text-white/40">{t("dlSubtitle")}</div>
            </div>
          </div>
          <button
            onClick={p.onClose}
            className="rounded-xl bg-white/[0.06] p-2 text-white/60 transition-all hover:bg-white/[0.12] hover:text-white active:scale-90"
            aria-label={t("close")}
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        {/* табы */}
        <div className="mb-3 flex shrink-0 gap-1 rounded-xl bg-white/[0.05] p-1">
          {tabBtn("link", t("tabLink"))}
          {tabBtn("search", t("tabSearch"))}
        </div>

        {/* содержимое таба */}
        {tab === "link" ? (
          <div className="shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (dupWarn) setDupWarn(false);
                }}
                onKeyDown={(e) => e.key === "Enter" && addUrl()}
                placeholder={t("linkPlaceholder")}
                className={`w-full rounded-xl border bg-black/25 px-3.5 py-2.5 text-sm font-medium text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]/60 ${
                  dupWarn ? "border-red-400/70" : "border-white/10"
                }`}
              />
              <button
                onClick={addUrl}
                disabled={!url.trim()}
                className={`${btnCls} shrink-0 bg-[var(--accent)] text-white hover:brightness-110 disabled:opacity-40`}
              >
                <IconPlus className="h-4 w-4" strokeWidth={3} />
                {t("addBtn")}
              </button>
            </div>
            {dupWarn && <div className="mt-1.5 px-1 text-[11px] font-bold text-red-400">{t("alreadyInQueue")}</div>}
            <div className="mt-2 flex items-start gap-1.5 px-1 text-[11px] font-semibold leading-relaxed text-white/35">
              <span>📁</span>
              <span>{p.destDir ? t("folderNote") : t("mp3Note")}</span>
            </div>
          </div>
        ) : (
          <div className="shrink-0">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  placeholder={t("searchPlaceholder2")}
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-black/25 py-2.5 pl-9 pr-3 text-sm font-medium text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]/60"
                />
              </div>
              <button
                onClick={doSearch}
                disabled={!query.trim() || searching}
                className={`${btnCls} shrink-0 bg-[var(--accent)] text-white hover:brightness-110 disabled:opacity-40`}
              >
                {searching ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <IconSearch className="h-4 w-4" strokeWidth={2.5} />
                )}
                {searching ? t("searching") : t("searchBtn")}
              </button>
            </div>

            {searchError && (
              <div className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">{searchError}</div>
            )}

            {!searchError && results.length > 0 && (
              <div className="mt-2 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                {t("resultsFound", { q: searchedQuery })}
              </div>
            )}

            <div className="scroll-thin mt-1.5 max-h-[236px] space-y-1 overflow-y-auto pr-1">
              {results.map((r) => (
                <div
                  key={r.url}
                  className="group flex cursor-default items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.05]"
                >
                  <Thumb src={r.thumb} size="h-10 w-10" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-white/85">{r.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/35">
                      {r.channel && <span className="truncate">{r.channel}</span>}
                      {r.duration > 0 && (
                        <>
                          <span>·</span>
                          <span className="shrink-0 tabular-nums">{formatTime(r.duration)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      p.onAddResult(r);
                    }}
                    className="shrink-0 rounded-lg bg-[var(--accent)]/15 px-2.5 py-1.5 text-[11px] font-bold text-[var(--accent)] transition-all hover:bg-[var(--accent)] hover:text-white active:scale-95"
                  >
                    <IconDownload className="mr-1 inline h-3.5 w-3.5" />
                    {t("download")}
                  </button>
                </div>
              ))}
              {!searching && searchedQuery && results.length === 0 && !searchError && (
                <div className="py-6 text-center text-xs font-semibold text-white/30">{t("searchEmpty")}</div>
              )}
              {!searchedQuery && !searching && (
                <div className="py-6 text-center text-xs font-medium text-white/25">{t("searchPlaceholder2")}</div>
              )}
            </div>
          </div>
        )}

        {/* папка назначения */}
        {p.destDir && (
          <div className="mt-3 flex shrink-0 items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
            <IconFolder className="h-4 w-4 shrink-0 text-[var(--accent)]" />
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">{t("destWillSaveTo")}</div>
              <div className="truncate font-mono text-[11px] text-white/55" title={p.destDir}>
                {p.destDir}
              </div>
            </div>
            <button
              onClick={() => window.volna?.openInExplorer(p.destDir)}
              className="shrink-0 rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-[11px] font-bold text-white/60 transition-colors hover:bg-white/[0.14] hover:text-white"
            >
              {t("openFolder")}
            </button>
          </div>
        )}

        {/* очередь */}
        {queueSection}

        <div className="mt-3 shrink-0 text-center text-[10px] font-medium text-white/25">{t("firstRunNote")}</div>
      </div>
    </div>
  );
}

const btnCls =
  "flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all active:scale-95 disabled:cursor-default";

/** Текст ошибки: клик копирует её в буфер обмена */
function ErrorBox({ error }: { error: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(error);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* буфер недоступен */
    }
  };
  return (
    <button
      onClick={copy}
      title={t("clickToCopy")}
      className={`mt-1.5 block w-full break-all rounded-lg px-2 py-1 text-left text-[10px] font-medium leading-relaxed transition-colors ${
        copied ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/10 text-red-300/90 hover:bg-red-500/20"
      }`}
    >
      {copied ? `✓ ${t("copied").replace("✓ ", "")}` : error}
    </button>
  );
}
