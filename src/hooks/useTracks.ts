import { useCallback, useEffect, useRef, useState } from "react";
import { deleteStored, getAllStored, loadMeta, saveMeta, saveTracks } from "../lib/db";
import { parseFileName } from "../lib/format";
import type { FolderScan, TagInfo } from "../electron.d";
import type { StoredTrack, Track } from "../types";
import { hashId, uid } from "../types";

function probeDuration(file: File): Promise<number> {
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

  /* ---------- загрузка из IndexedDB + сохранённой папки ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [stored, order, savedFolder] = await Promise.all([
          getAllStored(),
          loadMeta<string[]>("order"),
          loadMeta<{ path: string; name: string }>("folderPath"),
        ]);
        if (!alive) return;
        const list: Track[] = stored.map(({ blob: _b, ...meta }) => meta);
        if (order && order.length) {
          const pos = new Map(order.map((id, i) => [id, i]));
          list.sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9) || a.addedAt - b.addedAt);
        } else {
          list.sort((a, b) => a.addedAt - b.addedAt);
        }
        setTracks(list);
        if (savedFolder) {
          setFolder(savedFolder);
          // Electron: авто-синхронизация папки при старте
          if (window.volna) {
            const res = await window.volna.scanFolder(savedFolder.path);
            if (alive && res) {
              const n = await applyScanLocal(res);
              if (alive && n > 0) console.log(`[Волна] Папка синхронизирована: +${n} новых треков`);
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistOrder = useCallback((list: Track[]) => {
    saveMeta("order", list.map((t) => t.id)).catch(() => undefined);
  }, []);

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
        fav: old?.fav ?? false,
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
    async (res: FolderScan): Promise<number> => {
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

      // не-папочные треки сохраняем как были, папочные пересобираем
      const merged = [...prev.filter((t) => !t.path), ...next];
      setTracks(merged);
      persistOrder(merged);
      setFolderScanning(false);
      return added.length;
    },
    [makeFolderTrack, persistOrder]
  );

  /** Диалог выбора папки (Electron) */
  const pickFolder = useCallback(async (): Promise<FolderScan | null> => {
    if (!window.volna) return null;
    return window.volna.pickFolder();
  }, []);

  const rescanFolder = useCallback(async (): Promise<number> => {
    if (!window.volna || !folder) return 0;
    const res = await window.volna.scanFolder(folder.path);
    if (!res) return 0;
    return applyScanLocal(res);
  }, [folder, applyScanLocal]);

  const openFolderInExplorer = useCallback(() => {
    if (window.volna && folder) window.volna.openInExplorer(folder.path);
  }, [folder]);

  /* ---------- файлы через drag&drop / диалог файлов ---------- */
  const addFiles = useCallback(
    async (files: File[]): Promise<number> => {
      const existing = new Set(tracks.map((t) => `${t.fileName}|${t.fileSize}`));
      const fresh = files.filter((f) => !existing.has(`${f.name}|${f.size}`));
      if (!fresh.length) return 0;
      const added: StoredTrack[] = [];
      for (const f of fresh) {
        try {
          const duration = await probeDuration(f);
          const { title, artist } = parseFileName(f.name);
          added.push({
            id: uid(),
            title,
            artist,
            duration,
            addedAt: Date.now(),
            fav: false,
            fileName: f.name,
            fileSize: f.size,
            blob: f,
          });
        } catch {
          /* пропускаем битые файлы */
        }
      }
      if (!added.length) return 0;
      await saveTracks(added);
      setTracks((prev) => {
        const list = [...prev, ...added.map(({ blob: _b, ...meta }) => meta)];
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
    setTracks((prev) => {
      const list = prev.map((t) => (t.id === id ? { ...t, fav: !t.fav } : t));
      const changed = list.find((t) => t.id === id);
      if (changed) {
        getAllStored().then((stored) => {
          const rec = stored.find((s) => s.id === id);
          if (rec) saveTracks([{ ...changed, blob: rec.blob }]).catch(() => undefined);
        });
      }
      return list;
    });
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

  /** Трек, скачанный по ссылке (yt-dlp): уже лежит в userData/downloads */
  const addExternalTrack = useCallback(
    (t: { path: string; title: string }) => {
      const id = hashId(t.path);
      setTracks((prev) => {
        if (prev.some((x) => x.id === id)) return prev;
        const nt: Track = {
          id,
          title: t.title || t.path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "Скачано",
          artist: "",
          duration: 0,
          addedAt: Date.now(),
          fav: false,
          fileName: t.path.split(/[\\/]/).pop() || t.path,
          fileSize: 0,
          path: t.path,
        };
        const list = [...prev, nt];
        persistOrder(list);
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
