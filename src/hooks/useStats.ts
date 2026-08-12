import { useCallback, useEffect, useRef, useState } from "react";
import { loadMeta, saveMeta } from "../lib/db";

export interface TrackStat {
  count: number;
  lastPlayed: number;
  listened: number;
}

const KEY = "volna-stats";

/** Статистика: сколько раз играл каждый трек и сколько времени слушал. Хранится в IndexedDB. */
export function useStats() {
  const [stats, setStats] = useState<Record<string, TrackStat>>({});
  const loadedRef = useRef(false);

  useEffect(() => {
    loadMeta<Record<string, TrackStat>>(KEY)
      .then((s) => {
        if (s) setStats(s);
      })
      .catch(() => undefined)
      .finally(() => {
        loadedRef.current = true;
      });
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    const t = setTimeout(() => {
      saveMeta(KEY, stats).catch(() => undefined);
    }, 800);
    return () => clearTimeout(t);
  }, [stats]);

  const recordPlay = useCallback((id: string) => {
    setStats((prev) => {
      const s = prev[id] ?? { count: 0, lastPlayed: 0, listened: 0 };
      return { ...prev, [id]: { count: s.count + 1, lastPlayed: Date.now(), listened: s.listened } };
    });
  }, []);

  const recordListen = useCallback((id: string, ms: number) => {
    if (ms <= 0) return;
    setStats((prev) => {
      const s = prev[id] ?? { count: 0, lastPlayed: 0, listened: 0 };
      return { ...prev, [id]: { ...s, listened: s.listened + ms } };
    });
  }, []);

  return { stats, recordPlay, recordListen };
}
