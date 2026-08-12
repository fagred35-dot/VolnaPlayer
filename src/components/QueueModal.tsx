import type { Track } from "../types";
import { formatTime } from "../lib/format";
import TrackCover from "./TrackCover";
import { IconList, IconTrash, IconX } from "./icons";

interface Props {
  queue: Track[];
  onPlay: (t: Track) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}

/** Очередь воспроизведения — что сыграет следующим */
export default function QueueModal({ queue, onPlay, onRemove, onClear, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="anim-in glass bg-panel flex max-h-[80vh] w-full max-w-[460px] flex-col rounded-3xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
              <IconList className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-lg font-bold">Очередь</div>
              <div className="text-xs font-medium text-white/40">
                {queue.length ? `${queue.length} ${queue.length === 1 ? "трек" : queue.length < 5 ? "трека" : "треков"} дальше` : "пусто"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <button
                onClick={onClear}
                className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-bold text-white/50 transition-colors hover:bg-red-500/15 hover:text-red-300"
              >
                Очистить
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-xl bg-white/[0.06] p-2 text-white/60 transition-all hover:bg-white/[0.12] hover:text-white active:scale-90"
              aria-label="Закрыть"
            >
              <IconX className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="scroll-thin min-h-[120px] flex-1 overflow-y-auto pr-1">
          {queue.length === 0 ? (
            <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 py-8 text-center">
              <div className="text-3xl">📃</div>
              <div className="text-sm font-semibold text-white/50">Очередь пуста</div>
              <div className="max-w-[260px] text-xs text-white/30">
                Откройте меню трека (клик по названию внизу) и нажмите «В очередь»
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {queue.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onPlay(t)}
                  className="group flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.05]"
                >
                  <TrackCover track={t} className="h-9 w-9 rounded-lg text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white/85">{t.title}</div>
                    <div className="truncate text-xs text-white/40">{t.artist || "Неизвестный исполнитель"}</div>
                  </div>
                  <span className="text-[11px] tabular-nums text-white/30">{t.duration > 0 ? formatTime(t.duration) : "—:——"}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(t.id);
                    }}
                    className="rounded-lg p-1.5 text-white/25 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                    aria-label="Убрать из очереди"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
