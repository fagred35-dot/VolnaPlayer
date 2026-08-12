import { IconX } from "./icons";

interface Props {
  onClose: () => void;
}

interface OSS {
  name: string;
  url: string;
  desc: string;
}

const PROJECTS: OSS[] = [
  { name: "Electron", url: "https://electronjs.org", desc: "Оболочка Windows-приложения (chromium + node)" },
  { name: "React", url: "https://react.dev", desc: "Интерфейс приложения" },
  { name: "Vite", url: "https://vitejs.dev", desc: "Сборщик фронтенда" },
  { name: "Tailwind CSS", url: "https://tailwindcss.com", desc: "CSS-фреймворк интерфейса" },
  { name: "electron-builder", url: "https://www.electron.build", desc: "Сборка .exe установщика" },
  { name: "music-metadata", url: "https://github.com/Borewit/music-metadata", desc: "Чтение тегов и обложек MP3/FLAC" },
  { name: "yt-dlp", url: "https://github.com/yt-dlp/yt-dlp", desc: "Скачивание аудио по ссылке (1000+ сайтов)" },
  { name: "ffmpeg-static", url: "https://github.com/eugeneware/ffmpeg-static", desc: "FFmpeg для конвертации в MP3" },
  { name: "discord-rpc", url: "https://github.com/discordjs/RPC", desc: "Статус «слушает» в Discord" },
  { name: "Manrope / Unbounded", url: "https://fonts.google.com", desc: "Шрифты интерфейса (Google Fonts)" },
  { name: "iTunes Search API", url: "https://performance-partners.apple.com/search-api", desc: "Обложки альбомов по названию" },
  { name: "Deezer API", url: "https://developers.deezer.com", desc: "Запасной источник обложек" },
  { name: "Web Audio API", url: "https://developer.mozilla.org/docs/Web/API/Web_Audio_API", desc: "Эквалайзер и визуализация" },
];

/** Все open-source проекты, использованные в приложении (открывается зажатием логотипа «Волна») */
export default function CreditsModal({ onClose }: Props) {
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
          <div>
            <div className="font-display text-lg font-bold">Открытый код</div>
            <div className="mt-1 text-xs font-medium text-white/40">
              «Волна» собрана на этих open-source проектах
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

        <div className="scroll-thin flex-1 overflow-y-auto pr-1">
          <div className="space-y-1">
            {PROJECTS.map((p) => (
              <a
                key={p.name}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.05]"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-white/80"
                  style={{ background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #22d3ee))" }}
                >
                  ⧉
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-white/85 transition-colors group-hover:text-[var(--accent)]">
                    {p.name}
                  </div>
                  <div className="truncate text-xs text-white/40">{p.desc}</div>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-white/25 transition-colors group-hover:text-[var(--accent)]">
                  ↗
                </span>
              </a>
            ))}
          </div>
          <p className="mt-3 px-3 text-[11px] font-medium leading-relaxed text-white/30">
            Все проекты распространяются под свободными лицензиями (MIT, Apache-2.0, Unlicense и др.).
            Ссылки открываются в вашем браузере.
          </p>
        </div>
      </div>
    </div>
  );
}
