import { useI18n } from "../lib/i18n";
import { IconX } from "./icons";

interface Props {
  onClose: () => void;
}

interface OSS {
  name: string;
  url: string;
  license: string;
  descEn: string;
  descRu: string;
}

export const OSS_PROJECTS: OSS[] = [
  { name: "React", url: "https://react.dev", license: "MIT", descEn: "App interface", descRu: "Интерфейс приложения" },
  { name: "Vite", url: "https://vitejs.org", license: "MIT", descEn: "Frontend bundler", descRu: "Сборщик фронтенда" },
  { name: "TypeScript", url: "https://typescriptlang.org", license: "Apache-2.0", descEn: "Typing over JavaScript", descRu: "Типизация поверх JavaScript" },
  { name: "Tailwind CSS", url: "https://tailwindcss.com", license: "MIT", descEn: "UI CSS framework", descRu: "CSS-фреймворк интерфейса" },
  { name: "Capacitor", url: "https://capacitorjs.com", license: "MIT", descEn: "Android/iOS app shell", descRu: "Оболочка приложения Android/iOS" },
  { name: "Capacitor Filesystem", url: "https://github.com/ionic-team/capacitor-plugins", license: "MIT", descEn: "Music folder access on device", descRu: "Доступ к папкам с музыкой на устройстве" },
  { name: "capacitor-media-session", url: "https://github.com/jofr/capacitor-media-session", license: "MIT", descEn: "Lock-screen playback controls", descRu: "Управление плеером с экрана блокировки" },
  { name: "music-metadata", url: "https://github.com/Borewit/music-metadata", license: "MIT", descEn: "MP3/FLAC tags & covers parsing", descRu: "Чтение тегов и обложек MP3/FLAC" },
  { name: "youtubedl-android", url: "https://github.com/JunkFood02/youtubedl-android", license: "Apache-2.0", descEn: "yt-dlp engine on Android (downloads)", descRu: "Движок yt-dlp на Android (загрузки)" },
  { name: "yt-dlp", url: "https://github.com/yt-dlp/yt-dlp", license: "Unlicense", descEn: "Audio downloads by link (1000+ sites)", descRu: "Скачивание аудио по ссылке (1000+ сайтов)" },
  { name: "FFmpeg", url: "https://ffmpeg.org", license: "LGPL/GPL", descEn: "Audio conversion (MP3)", descRu: "Конвертация аудио (MP3)" },
  { name: "Electron", url: "https://electronjs.org", license: "MIT", descEn: "Windows app shell (chromium + node)", descRu: "Оболочка Windows-приложения (chromium + node)" },
  { name: "electron-builder", url: "https://www.electron.build", license: "MIT", descEn: ".exe installer packaging", descRu: "Сборка .exe установщика" },
  { name: "discord-rpc", url: "https://github.com/discordjs/RPC", license: "MIT", descEn: "«Listening» status in Discord (desktop)", descRu: "Статус «слушает» в Discord (десктоп)" },
  { name: "Manrope / Unbounded", url: "https://fonts.google.com", license: "OFL", descEn: "Interface fonts (Google Fonts)", descRu: "Шрифты интерфейса (Google Fonts)" },
  { name: "iTunes Search API", url: "https://performance-partners.apple.com/search-api", license: "Apple API", descEn: "Album art lookup by title", descRu: "Обложки альбомов по названию" },
  { name: "Deezer API", url: "https://developers.deezer.com", license: "Deezer API", descEn: "Backup album art source", descRu: "Запасной источник обложек" },
];

/** Все open-source проекты, использованные в приложении (открывается зажатием логотипа «Волна») */
export default function CreditsModal({ onClose }: Props) {
  const { t, lang } = useI18n();
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
            <div className="font-display text-lg font-bold">{t("creditsTitle")}</div>
            <div className="mt-1 text-xs font-medium text-white/40">{t("creditsSubtitle")}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/[0.06] p-2 text-white/60 transition-all hover:bg-white/[0.12] hover:text-white active:scale-90"
            aria-label={t("close")}
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto pr-1">
          <div className="space-y-1">
            {OSS_PROJECTS.map((p) => (
              <a
                key={p.name}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.05]"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-white/80"
                  style={{ background: "var(--accent-grad)" }}
                >
                  ⧉
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-white/85 transition-colors group-hover:text-[var(--accent)]">
                    {p.name}
                    <span className="ml-2 text-[10px] font-bold text-white/25">{p.license}</span>
                  </div>
                  <div className="truncate text-xs text-white/40">{lang === "ru" ? p.descRu : p.descEn}</div>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-white/25 transition-colors group-hover:text-[var(--accent)]">
                  ↗
                </span>
              </a>
            ))}
          </div>
          <p className="mt-3 px-3 text-[11px] font-medium leading-relaxed text-white/30">{t("creditsFooter")}</p>
        </div>
      </div>
    </div>
  );
}
