import { useCallback, useEffect, useRef, useState } from "react";
import { loadMeta, saveMeta } from "../lib/db";
import { uid, type Playlist } from "../types";

export type { Playlist };

const KEY = "volna-playlists-v1";

/** Плейлисты: создание, удаление, добавление/удаление треков, порядок. Хранятся в IndexedDB. */
export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadMeta<Playlist[]>(KEY)
      .then((p) => {
        loadedRef.current = true;
        if (!Array.isArray(p)) return;
        // Если до конца загрузки состояние уже изменилось (sync-merge создал
        // плейлист, пользователь что-то добавил) — объединяем, а не затираем:
        // локальные версии приоритетнее сохранённых.
        setPlaylists((prev) => {
          if (!prev.length) return p;
          const prevIds = new Set(prev.map((x) => x.id));
          return [...prev, ...p.filter((x) => !prevIds.has(x.id))];
        });
      })
      .catch(() => {
        loadedRef.current = true;
      });
  }, []);

  useEffect(() => {
    if (loadedRef.current) saveMeta(KEY, playlists).catch(() => undefined);
  }, [playlists]);

  const create = useCallback((name: string) => {
    const pl: Playlist = {
      id: uid(),
      name: name.trim() || "Новый плейлист",
      trackIds: [],
      createdAt: Date.now(),
    };
    setPlaylists((prev) => [...prev, pl]);
    setActiveId(pl.id);
    return pl.id;
  }, []);

  const remove = useCallback((id: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  const addTrack = useCallback((plId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === plId && !p.trackIds.includes(trackId) ? { ...p, trackIds: [...p.trackIds, trackId] } : p
      )
    );
  }, []);

  const removeTrack = useCallback((plId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((p) => (p.id === plId ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) } : p))
    );
  }, []);

  /** Убирает трек из ВСЕХ плейлистов (при удалении файла) */
  const removeTrackFromAll = useCallback((trackId: string) => {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.trackIds.includes(trackId) ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) } : p
      )
    );
  }, []);

  const moveTrack = useCallback((plId: string, fromId: string, toId: string) => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== plId) return p;
        const from = p.trackIds.indexOf(fromId);
        const to = p.trackIds.indexOf(toId);
        if (from < 0 || to < 0 || from === to) return p;
        const ids = [...p.trackIds];
        const [m] = ids.splice(from, 1);
        ids.splice(to, 0, m);
        return { ...p, trackIds: ids };
      })
    );
  }, []);

  return { playlists, activeId, setActiveId, setPlaylists, create, remove, addTrack, removeTrack, removeTrackFromAll, moveTrack };
}
