import { IconFolder, IconPlus } from "./icons";

interface Props {
  onAddFiles: () => void;
  onAddFolder: () => void;
}

export default function EmptyState({ onAddFiles, onAddFolder }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6">
      <div className="flex w-full max-w-xl flex-col items-center gap-5 rounded-[2rem] border-2 border-dashed border-white/15 bg-white/[0.02] px-8 py-14 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--accent)]/15 text-4xl">
          🎧
        </div>
        <div>
          <div className="font-display text-xl font-bold">Библиотека пуста</div>
          <div className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/40">
            Перетащите сюда аудиофайлы или добавьте их с диска. Всё хранится локально — интернет не нужен.
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={onAddFiles}
            className="flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95"
            style={{
              background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #22d3ee))",
              boxShadow: "0 8px 24px -8px var(--accent)",
            }}
          >
            <IconPlus className="h-4 w-4" strokeWidth={3} />
            Выбрать файлы
          </button>
          <button
            onClick={onAddFolder}
            className="glass flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <IconFolder className="h-4 w-4" />
            Целую папку
          </button>
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/25">
          MP3 · FLAC · WAV · OGG · M4A · AAC · OPUS
        </div>
      </div>
    </div>
  );
}
