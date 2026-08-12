import { useCallback, useEffect, useState } from "react";
import { IconDownload, IconX } from "./icons";

interface Props {
  onClose: () => void;
  onDone: (d: { path: string; title: string }) => void;
}

type Phase = "idle" | "busy" | "error";

/** Скачивание аудио по ссылке через yt-dlp (1000+ сайтов, не только YouTube) */
export default function DownloadModal({ onClose, onDone }: Props) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!window.volna) return;
    const offP = window.volna.onDlProgress((p) => {
      setPhase("busy");
      setProgress(p.percent);
      setStatus(p.status);
    });
    const offD = window.volna.onDlDone((d) => {
      setPhase("idle");
      onDone(d);
    });
    const offE = window.volna.onDlError((e) => {
      setPhase("error");
      setError(e.message);
      setStatus("");
    });
    return () => {
      offP();
      offD();
      offE();
    };
  }, [onDone]);

  const start = useCallback(async () => {
    if (!url.trim() || !window.volna) return;
    setPhase("busy");
    setError("");
    setProgress(0);
    setStatus("Запуск…");
    await window.volna.dlStart(url.trim());
  }, [url]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="anim-in glass bg-panel w-full max-w-[460px] rounded-3xl p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
              <IconDownload className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-lg font-bold">Скачать в аудио</div>
              <div className="text-xs font-medium text-white/40">yt-dlp · 1000+ сайтов</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/[0.06] p-2 text-white/60 transition-all hover:bg-white/[0.12] hover:text-white active:scale-90"
            aria-label="Закрыть"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && start()}
          placeholder="Вставьте ссылку на видео: YouTube, VK, Twitch, TikTok…"
          disabled={phase === "busy"}
          className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-sm font-medium text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]/60 disabled:opacity-50"
        />

        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-white/35">
          <span>
            Трек появится в библиотеке с обложкой и названием.
            <br />
            MP3 при наличии FFmpeg, иначе M4A.
          </span>
          <button
            onClick={start}
            disabled={phase === "busy" || !url.trim()}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
          >
            <IconDownload className="h-4 w-4" />
            {phase === "busy" ? "Скачиваю…" : "Скачать"}
          </button>
        </div>

        {phase === "busy" && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
              <span className="text-white/60">{status || "Работаю…"}</span>
              <span className="text-[var(--accent)]">{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
              />
            </div>
            <div className="mt-2 text-center text-[10px] font-medium text-white/30">
              первый запуск может скачивать yt-dlp (~17 МБ) и FFmpeg
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="mt-4 rounded-xl bg-red-500/10 px-3.5 py-3 text-xs font-semibold leading-relaxed text-red-300">
            ❌ {error}
          </div>
        )}
      </div>
    </div>
  );
}
