import { useCallback, useEffect, useRef, useState } from "react";
import { loadMeta, saveMeta } from "../lib/db";
import { uid } from "../types";

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

const KEY = "volna-playlists-v1";

/** Плейлисты: создание, удаление, добавление/удаление треков, порядок. Хранятся в IndexedDB. */
export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadMeta<Playlist[]>(KEY)
      .then((p) => {
        if (Array.isArray(p)) setPlaylists(p);
      })
      .catch(() => undefined);
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

  return { playlists, activeId, setActiveId, create, remove, addTrack, removeTrack, removeTrackFromAll, moveTrack };
}
