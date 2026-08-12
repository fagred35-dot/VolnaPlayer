import type { Track } from "../types";
import { formatTotal, plural } from "../lib/format";
import TrackCover from "./TrackCover";
import { IconDisc } from "./icons";

export interface AlbumGroup {
  key: string;
  name: string;
  artist: string;
  cover: Track;
  tracks: Track[];
  totalDur: number;
}

interface Props {
  groups: AlbumGroup[];
  onOpen: (key: string) => void;
}

/** Альбомный вид: сетка альбомов, собранных по тегам (альбом + исполнитель) */
export default function AlbumsGrid({ groups, onOpen }: Props) {
  return (
    <div className="scroll-thin h-full overflow-y-auto px-3 pb-3">
      {groups.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="text-4xl">💿</div>
          <div className="text-sm font-semibold text-white/50">Нет альбомов</div>
          <div className="text-xs text-white/30">
            Альбомы собираются из тегов файлов — добавьте музыку с заполненными тегами
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {groups.map((g) => (
            <button
              key={g.key}
              onClick={() => onOpen(g.key)}
              className="group rounded-2xl bg-white/[0.04] p-2.5 text-left transition-all hover:bg-white/[0.08] active:scale-[0.98]"
            >
              <TrackCover track={g.cover} className="aspect-square w-full rounded-xl text-3xl" />
              <div className="mt-2 truncate text-sm font-bold text-white/90 transition-colors group-hover:text-[var(--accent)]">
                {g.name}
              </div>
              <div className="truncate text-xs text-white/40">{g.artist}</div>
              <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-white/30">
                <IconDisc className="h-3 w-3" />
                {g.tracks.length} {plural(g.tracks.length, ["трек", "трека", "треков"])} · {formatTotal(g.totalDur)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
