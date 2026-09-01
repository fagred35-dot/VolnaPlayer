import { useCallback, useEffect, useRef, useState } from "react";
import { deleteStored, getAllStored, getStoredBlob, loadMeta, saveMeta, saveTracks } from "../lib/db";
import { parseFileName } from "../lib/format";
import type { FolderScan, TagInfo } from "../electron.d";
import type { StoredTrack, Track } from "../types";
import { hashId, uid } from "../types";

function probeDuration(file: File | Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    let settled = false;
    const done = (d: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) && d > 0 ? d : 0);
    };
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done(0);
    a.preload = "metadata";
    a.src = url;
    setTimeout(() => done(a.duration || 0), 8000);
  });
}

function joinAbs(root: string, rel: string): string {
  return `${root.replace(/[\\/]+$/, "")}\\${rel.replace(/\//g, "\\")}`;
}

export function useTracks() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [ready, setReady] = useState(false);
  const [folder, setFolder] = useState<{ path: string; name: string } | null>(null);
  const [folderScanning, setFolderScanning] = useState(false);
  const tracksRef = useRef<Track[]>([]);
  tracksRef.current = tracks;
  const favsRef = useRef<Set<string>>(new Set());

  /* ---------- загрузка из IndexedDB + сохранённой папки ---------- */
  useEffect(() => {
    (async () => {
      try {
        const [stored, order, savedFolder, favs] = await Promise.all([
          getAllStored(),
          loadMeta<string[]>("order"),
          loadMeta<{ path: string; name: string }>("folderPath"),
          loadMeta<string[]>("favs"),
        ]);
        favsRef.current = new Set(Array.isArray(favs) ? favs : []);
        const list: Track[] = stored.map(({ blob: _b, ...meta }) => meta);
        if (order && order.length) {
          const pos = new Map(order.map((id, i) => [id, i]));
          list.sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9) || b.addedAt - a.addedAt);
        } else {
          // без сохранённого порядка — новые сверху
          list.sort((a, b) => b.addedAt - a.addedAt);
        }
        setTracks(list);
        if (savedFolder) {
          setFolder(savedFolder);
          // Electron: авто-синхронизация папки при старте
          if (window.volna) {
            const res = await window.volna.scanFolder(savedFolder.path);
            if (res) {
              const r = await applyScanLocal(res);
              if (r.added > 0) console.log(`[Волна] Папка синхронизирована: +${r.added} новых треков`);
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistOrder = useCallback((list: Track[]) => {
    saveMeta("order", list.map((t) => t.id)).catch(() => undefined);
  }, []);

  /* ---------- дочитываем теги треков, у чего-то не хватает ----------
     Некоторые файлы не успевают/не могут отдать длительность при добавлении
     (медленный диск, редкий формат), а старые скачивания могли пройти без
     исполнителя и обложки. Здесь молча досчитываем недостающее в фоне. */
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      const storedAll = await getAllStored().catch(() => [] as StoredTrack[]);
      const storedById = new Map(storedAll.map((s) => [s.id, s]));
      const need = tracksRef.current.filter(
        (t) => !t.duration || (t.path && (!t.artist || !t.coverHash))
      );
      for (const tr of need) {
        if (!alive) return;
        let tags: TagInfo | undefined;
        if (tr.path && window.volna) {
          try {
            tags = (await window.volna.getTags([tr.path]))?.[tr.path];
          } catch {
            /* пропускаем */
          }
        }
        let d = tags?.duration ?? 0;
        if (!d && !tr.path) {
          try {
            const blob = await getStoredBlob(tr.id);
            if (blob) d = await probeDuration(blob);
          } catch {
            /* пропускаем */
          }
        }
        const patch: Partial<Track> = {};
        if (d && !tr.duration) patch.duration = d;
        if (tags) {
          if (tags.artist && !tr.artist) patch.artist = tags.artist;
          if (tags.album && !tr.album) patch.album = tags.album;
          if (tags.coverHash && !tr.coverHash) patch.coverHash = tags.coverHash;
        }
        if (!alive || !Object.keys(patch).length) continue;
        setTracks((prev) => prev.map((x) => (x.id === tr.id ? { ...x, ...patch } : x)));
        // сохраняем в IndexedDB, если трек там хранится (файлы и скачанные)
        try {
          const rec = storedById.get(tr.id);
          if (rec) await saveTracks([{ ...rec, ...patch }]);
        } catch {
          /* не критично */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [ready]);

  const makeFolderTrack = useCallback(
    (f: FolderScan["files"][number], abs: string, tags?: TagInfo, old?: Track): Track => {
      const parsed = parseFileName(f.rel);
      return {
        id: hashId(abs),
        title: tags?.title || old?.title || parsed.title,
        artist: tags?.artist || old?.artist || parsed.artist,
        album: tags?.album ?? old?.album,
        duration: tags?.duration || old?.duration || 0,
        addedAt: old?.addedAt ?? Date.now(),
        fav: old?.fav ?? favsRef.current.has(hashId(abs)),
        fileName: f.rel,
        fileSize: f.size,
        fileMtime: f.mtimeMs,
        path: abs,
        coverHash: tags?.coverHash ?? old?.coverHash,
      };
    },
    []
  );

  /** Применяет результат сканирования папки к библиотеке */
  const applyScanLocal = useCallback(
    async (res: FolderScan): Promise<{ added: number; truncated: boolean }> => {
      setFolderScanning(true);
      setFolder({ path: res.path, name: res.name });
      saveMeta("folderPath", { path: res.path, name: res.name }).catch(() => undefined);

      const prev = tracksRef.current;
      const prevByPath = new Map(prev.filter((t) => t.path).map((t) => [t.path as string, t]));
      const added: string[] = [];
      const changed: string[] = [];
      for (const f of res.files) {
        const abs = joinAbs(res.path, f.rel);
        const old = prevByPath.get(abs);
        if (!old) added.push(abs);
        else if (old.fileSize !== f.size || old.fileMtime !== f.mtimeMs) changed.push(abs);
      }

      let tags: Record<string, TagInfo | undefined> = {};
      if (window.volna && (added.length || changed.length)) {
        try {
          tags = (await window.volna.getTags([...added, ...changed])) ?? {};
        } catch {
          tags = {};
        }
      }

      const next: Track[] = res.files.map((f) => {
        const abs = joinAbs(res.path, f.rel);
        const old = prevByPath.get(abs);
        return makeFolderTrack(f, abs, tags[abs], old);
      });

      // ВАЖНО: убираем из prev ТОЛЬКО треки, которые лежат ВНУТРИ сканируемой папки.
      // Треки с путями вне папки (например, скачанные по ссылке) не трогаем —
      // иначе они пропадали из библиотеки при каждом пересканировании.
      const inFolder = (p: string) => {
        const f = res.path.replace(/[\\/]+$/, "");
        return p === f || p.startsWith(f + "\\") || p.startsWith(f + "/");
      };
      const nextByPath = new Map<string, Track>();
      for (const t of next) if (t.path) nextByPath.set(t.path, t);
      const addedSet = new Set(added);
      // новые треки — наверх, существующие сохраняют свой порядок (с обновлёнными тегами)
      const merged: Track[] = [
        ...next.filter((t) => t.path && addedSet.has(t.path)),
        ...prev
          .map((t) => (t.path && inFolder(t.path) ? nextByPath.get(t.path) ?? null : t))
          .filter((t): t is Track => t !== null),
      ];
      setTracks(merged);
      persistOrder(merged);
      setFolderScanning(false);
      return { added: added.length, truncated: !!res.truncated };
    },
    [makeFolderTrack, persistOrder]
  );

  /** Диалог выбора папки (Electron) */
  const pickFolder = useCallback(async (): Promise<FolderScan | null> => {
    if (!window.volna) return null;
    return window.volna.pickFolder();
  }, []);

  const rescanFolder = useCallback(async (): Promise<{ added: number; truncated: boolean }> => {
    if (!window.volna || !folder) return { added: 0, truncated: false };
    const res = await window.volna.scanFolder(folder.path);
    if (!res) return { added: 0, truncated: false };
    return applyScanLocal(res);
  }, [folder, applyScanLocal]);

  const openFolderInExplorer = useCallback(() => {
    if (window.volna && folder) window.volna.openInExplorer(folder.path);
  }, [folder]);

  /* ---------- файлы через drag&drop / диалог файлов ---------- */
  const addFiles = useCallback(
    async (files: File[]): Promise<number> => {
      const existing = new Set(tracks.map((t) => `${t.fileName}|${t.fileSize}`));
      const existingExact = new Set(
        tracks.filter((t) => t.fileLastModified).map((t) => `${t.fileName}|${t.fileLastModified}`)
      );
      const fresh = files.filter((f) => {
        if (existing.has(`${f.name}|${f.size}`)) return false;
        if (existingExact.has(`${f.name}|${f.lastModified}`)) return false;
        return true;
      });
      if (!fresh.length) return 0;
      const results: (StoredTrack | null)[] = new Array(fresh.length).fill(null);
      let idx = 0;
      const workers = Array.from({ length: Math.min(6, fresh.length) }, async () => {
        while (idx < fresh.length) {
          const i = idx++;
          const f = fresh[i];
          try {
            const duration = await probeDuration(f);
            const { title, artist } = parseFileName(f.name);
            results[i] = {
              id: uid(),
              title,
              artist,
              duration,
              addedAt: Date.now(),
              fav: false,
              fileName: f.name,
              fileSize: f.size,
              fileLastModified: f.lastModified,
              blob: f,
            };
          } catch {
            /* пропускаем битые файлы */
          }
        }
      });
      await Promise.all(workers);
      const added = results.filter((t): t is StoredTrack => t !== null);
      if (!added.length) return 0;
      await saveTracks(added);
      setTracks((prev) => {
        // новые файлы — наверх списка
        const list = [...added.map(({ blob: _b, ...meta }) => meta), ...prev];
        persistOrder(list);
        return list;
      });
      return added.length;
    },
    [tracks, persistOrder]
  );

  const removeTrack = useCallback(
    (id: string) => {
      deleteStored(id).catch(() => undefined);
      setTracks((prev) => {
        const list = prev.filter((t) => t.id !== id);
        persistOrder(list);
        return list;
      });
    },
    [persistOrder]
  );

  const toggleFav = useCallback((id: string) => {
    const cur = tracksRef.current.find((t) => t.id === id);
    const nextFav = cur ? !cur.fav : true;
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, fav: !t.fav } : t)));
    if (!cur) return;
    if (cur.path) {
      const set = new Set(favsRef.current);
      if (nextFav) set.add(id);
      else set.delete(id);
      favsRef.current = set;
      saveMeta("favs", [...set]).catch(() => undefined);
    }
    getAllStored()
      .then((stored) => {
        const rec = stored.find((s) => s.id === id);
        if (rec) saveTracks([{ ...cur, fav: nextFav, blob: rec.blob }]).catch(() => undefined);
      })
      .catch(() => undefined);
  }, []);

  const updateTrack = useCallback((id: string, patch: Partial<Track>) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const reorder = useCallback(
    (from: number, to: number, visible: Track[]) => {
      if (from === to) return;
      const a = visible[from];
      const b = visible[to];
      setTracks((prev) => {
        const list = [...prev];
        const ia = list.findIndex((t) => t.id === a.id);
        const ib = list.findIndex((t) => t.id === b.id);
        if (ia < 0 || ib < 0) return prev;
        const [moved] = list.splice(ia, 1);
        list.splice(ib, 0, moved);
        persistOrder(list);
        return list;
      });
    },
    [persistOrder]
  );

  /** Трек, скачанный по ссылке (yt-dlp): уже лежит в userData/downloads.
   *  Сохраняется в IndexedDB, чтобы переживать перезапуск приложения.
   *  Если трек уже есть (тот же путь) — обновляем теги, пришедшие с файла. */
  const addExternalTrack = useCallback(
    (t: { path: string; title: string; artist?: string; album?: string; duration?: number; coverHash?: string | null }) => {
      const id = hashId(t.path);
      setTracks((prev) => {
        const existing = prev.find((x) => x.id === id);
        if (existing) {
          return prev.map((x) =>
            x.id === id
              ? {
                  ...x,
                  title: t.title || x.title,
                  artist: t.artist || x.artist,
                  album: t.album || x.album,
                  duration: t.duration || x.duration,
                  coverHash: t.coverHash || x.coverHash,
                }
              : x
          );
        }
        const nt: Track = {
          id,
          title: t.title || t.path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "Скачано",
          artist: t.artist || "",
          album: t.album || undefined,
          duration: t.duration || 0,
          addedAt: Date.now(),
          fav: false,
          fileName: t.path.split(/[\\/]/).pop() || t.path,
          fileSize: 0,
          path: t.path,
          coverHash: t.coverHash || undefined,
        };
        const list = [nt, ...prev];
        persistOrder(list);
        saveTracks([{ ...nt, blob: undefined }]).catch(() => undefined);
        return list;
      });
    },
    [persistOrder]
  );

  return {
    tracks,
    ready,
    folder,
    folderScanning,
    addFiles,
    removeTrack,
    toggleFav,
    updateTrack,
    reorder,
    pickFolder,
    rescanFolder,
    openFolderInExplorer,
    applyScanLocal,
    addExternalTrack,
  };
}
