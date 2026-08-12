import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import { engine } from "./engine/AudioEngine";
import { getStoredBlob, loadMeta, saveMeta } from "./lib/db";
import { formatTotal, isAudioFile, plural } from "./lib/format";
import type { EqState, RepeatMode, SortKey, Toast, Track } from "./types";
import { useTracks } from "./hooks/useTracks";
import Sidebar from "./components/Sidebar";
import PlayerBar from "./components/PlayerBar";
import Playlist from "./components/Playlist";
import NowPlaying from "./components/NowPlaying";
import Equalizer from "./components/Equalizer";
import SleepTimer from "./components/SleepTimer";
import Toasts from "./components/Toasts";
import EmptyState from "./components/EmptyState";
import ThemesModal from "./components/ThemesModal";
import QueueModal from "./components/QueueModal";
import TrackMenu from "./components/TrackMenu";
import { usePlaylists } from "./hooks/usePlaylists";
import { IconFolder, IconGrid, IconList, IconMenu, IconPlus, IconSearch, IconSort } from "./components/icons";
import { themeCss, THEMES } from "./theme/themes";
import StatsModal from "./components/StatsModal";
import AlbumsGrid from "./components/AlbumsGrid";
import CreditsModal from "./components/CreditsModal";
import DownloadModal from "./components/DownloadModal";
import { useStats } from "./hooks/useStats";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "order", label: "Как добавлены" },
  { key: "title", label: "Название" },
  { key: "artist", label: "Исполнитель" },
  { key: "album", label: "Альбом" },
  { key: "duration", label: "Длительность" },
  { key: "added", label: "Дата добавления" },
];

const SPEEDS = [1, 1.25, 1.5, 2, 0.75];
const DEFAULT_EQ: EqState = {
  enabled: false,
  gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  preset: "Плоский",
};

export default function App() {
  const {
    tracks,
    ready,
    folder,
    folderScanning,
    addFiles,
    removeTrack,
    toggleFav,
    updateTrack,
    reorder,
    rescanFolder,
    openFolderInExplorer,
    applyScanLocal,
    addExternalTrack,
  } = useTracks();

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [shuffle, setShuffle] = useState(false);
  const [search, setSearch] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("order");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [eq, setEq] = useState<EqState>(DEFAULT_EQ);
  const [accent, setAccent] = useState("#8b5cf6");
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const [modal, setModal] = useState<{ now: boolean; eq: boolean; timer: boolean }>({
    now: false,
    eq: false,
    timer: false,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [trackGains, setTrackGains] = useState<Record<string, number>>({});
  const pl = usePlaylists();
  const playlists = pl.playlists;
  const activePlaylistId = pl.activeId;
  const activePlaylist = playlists.find((x) => x.id === activePlaylistId) ?? null;

  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [menuTrack, setMenuTrack] = useState<{ track: Track; x: number; y: number } | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "albums">("list");
  const [albumKey, setAlbumKey] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);
  const [rpcOn, setRpcOn] = useState(true);
  const { stats, recordPlay, recordListen } = useStats();
  const playStartRef = useRef<number | null>(null);
  const statIdRef = useRef<string | null>(null);

  const [themesOpen, setThemesOpen] = useState(false);
  const [themeId, setThemeId] = useState("volna");
  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const [wallDim, setWallDim] = useState(0.35);
  const [wallBlur, setWallBlur] = useState(0);
  const [customCss, setCustomCss] = useState("");
  const [cssEnabled, setCssEnabled] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const urlRef = useRef<string | null>(null);
  const pendingPlayRef = useRef(false);
  const toastIdRef = useRef(1);
  const lastSaveRef = useRef(0);
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const recentTracks = useMemo(() => {
    return tracks
      .map((t) => ({ t, last: stats[t.id]?.lastPlayed ?? 0 }))
      .filter((x) => x.last > 0)
      .sort((a, b) => b.last - a.last)
      .slice(0, 30)
      .map((x) => x.t);
  }, [tracks, stats]);

  const albumGroups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; artist: string; cover: Track; tracks: Track[]; totalDur: number }>();
    const base = favOnly ? tracks.filter((t) => t.fav) : recentOpen ? recentTracks : tracks;
    for (const t of base) {
      const key = `${(t.artist || "?").toLowerCase()}||${(t.album || "").toLowerCase()}`;
      const g = map.get(key);
      if (g) {
        g.tracks.push(t);
        g.totalDur += t.duration;
      } else {
        map.set(key, {
          key,
          name: t.album || (t.artist ? "Без альбома" : "Неизвестный альбом"),
          artist: t.artist || "Неизвестный исполнитель",
          cover: t,
          tracks: [t],
          totalDur: t.duration,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [tracks, favOnly, recentOpen, recentTracks]);

  const albumGroup = albumKey ? albumGroups.find((g) => g.key === albumKey) ?? null : null;

  const visibleTracks = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = tracks;
    if (recentOpen) {
      list = recentTracks;
    } else if (activePlaylist) {
      const orderMap = new Map(activePlaylist.trackIds.map((id, i) => [id, i]));
      list = list.filter((t) => orderMap.has(t.id));
      if (sort === "order") list = [...list].sort((a, b) => orderMap.get(a.id)! - orderMap.get(b.id)!);
    }
    if (favOnly) list = list.filter((t) => t.fav);
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.fileName.toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    if (sort !== "order") {
      sorted.sort((a, b) => {
        switch (sort) {
          case "title":
            return a.title.localeCompare(b.title, "ru");
          case "artist":
            return (a.artist || "~").localeCompare(b.artist || "~", "ru") || a.title.localeCompare(b.title, "ru");
          case "album":
            return (a.album || "~").localeCompare(b.album || "~", "ru") || a.title.localeCompare(b.title, "ru");
          case "duration":
            return a.duration - b.duration;
          default:
            return b.addedAt - a.addedAt;
        }
      });
      if (sortDir === -1) sorted.reverse();
    }
    return sorted;
  }, [tracks, activePlaylist, favOnly, recentOpen, recentTracks, search, sort, sortDir]);

  const currentTrack = tracks.find((t) => t.id === currentId) ?? null;
  const trackRef = useRef<Track | null>(null);
  trackRef.current = currentTrack;

  const stateRef = useRef({ currentId, isPlaying, repeat, shuffle, queue: visibleTracks, tracks, queueIds });
  stateRef.current = { currentId, isPlaying, repeat, shuffle, queue: visibleTracks, tracks, queueIds };

  const pushToast = useCallback((icon: string, text: string) => {
    const id = toastIdRef.current++;
    setToasts((p) => [...p.slice(-3), { id, text, icon }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3200);
  }, []);

  /* ---------- управление воспроизведением ---------- */
  const playTrack = useCallback((t: Track) => {
    // если трек стоял в очереди — он сыграл, убираем
    setQueueIds((prev) => (prev.includes(t.id) ? prev.filter((id) => id !== t.id) : prev));
    if (stateRef.current.currentId === t.id) {
      engine.play();
      return;
    }
    setCurrentId(t.id);
    pendingPlayRef.current = true;
  }, []);

  /** «Играть следующим» — трек встаёт первым в очередь (очередь играет приоритетно) */
  const playNext = useCallback((t: Track) => {
    if (stateRef.current.currentId === t.id) {
      engine.seek(0);
      engine.play();
      return;
    }
    setQueueIds((prev) => [t.id, ...prev.filter((id) => id !== t.id)]);
    pushToast("⏭", `Дальше: ${t.title}`);
  }, [pushToast]);

  const queueTrack = useCallback(
    (t: Track) => {
      setQueueIds((prev) => (prev.includes(t.id) ? prev : [...prev, t.id]));
      pushToast("📃", `В очередь: ${t.title}`);
    },
    [pushToast]
  );

  const next = useCallback(() => {
    const s = stateRef.current;
    const q = s.queue;
    // сначала очередь — она играет приоритетно
    const queuedId = s.queueIds[0];
    if (queuedId) {
      setQueueIds((prev) => prev.slice(1));
      const pick = s.tracks.find((t) => t.id === queuedId);
      if (pick) {
        playTrack(pick);
        return;
      }
    }
    if (!q.length) return;
    if (s.shuffle) {
      const cur = q.findIndex((t) => t.id === s.currentId);
      const cands = q.length > 1 ? q.filter((_, i) => i !== cur) : q;
      const pick = cands[Math.floor(Math.random() * cands.length)];
      if (pick) {
        if (pick.id === s.currentId) {
          engine.seek(0);
          engine.play();
        } else playTrack(pick);
      }
      return;
    }
    const idx = q.findIndex((t) => t.id === s.currentId);
    let ni = idx + 1;
    if (ni >= q.length) {
      if (s.repeat === "all") ni = 0;
      else {
        engine.pause();
        setIsPlaying(false);
        return;
      }
    }
    const pick = q[ni];
    if (pick) playTrack(pick);
  }, [playTrack]);

  const prev = useCallback(() => {
    const s = stateRef.current;
    const q = s.queue;
    if (!q.length) return;
    if (s.currentId && engine.el.currentTime > 3) {
      engine.seek(0);
      return;
    }
    const idx = q.findIndex((t) => t.id === s.currentId);
    let pi = idx - 1;
    if (pi < 0) pi = s.repeat === "all" ? q.length - 1 : 0;
    const pick = q[pi];
    if (pick && pick.id !== s.currentId) playTrack(pick);
  }, [playTrack]);

  const togglePlay = useCallback(() => {
    const s = stateRef.current;
    if (!s.currentId) {
      if (s.queue.length) playTrack(s.queue[0]);
      return;
    }
    if (s.isPlaying) engine.pause();
    else engine.play();
  }, [playTrack]);

  const handleEnded = useCallback(() => {
    if (stateRef.current.repeat === "one") {
      engine.seek(0);
      engine.play();
      return;
    }
    next();
  }, [next]);

  const seekTo = useCallback((f: number) => {
    const d = engine.el.duration || 0;
    if (d > 0) engine.seek(f * d);
  }, []);

  const seekBy = useCallback((delta: number) => {
    const d = engine.el.duration || 0;
    const t = Math.min(Math.max(0, engine.el.currentTime + delta), d || engine.el.currentTime + delta);
    engine.seek(t);
  }, []);

  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    if (v > 0) setMuted(false);
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  /* ---------- привязка движка ---------- */
  useEffect(() => {
    engine.onTime = (t) => {
      setTime(t);
      const n = performance.now();
      if (n - lastSaveRef.current > 10000) {
        lastSaveRef.current = n;
        const id = stateRef.current.currentId;
        if (id) saveMeta("position", { id, time: t }).catch(() => undefined);
      }
    };
    engine.onEnded = handleEnded;
    const onPlay = () => {
      setIsPlaying(true);
      const now = Date.now();
      const prevId = statIdRef.current;
      if (prevId && playStartRef.current) recordListen(prevId, now - playStartRef.current);
      const id = stateRef.current.currentId;
      playStartRef.current = id ? now : null;
      statIdRef.current = id ?? null;
      if (id) recordPlay(id);
    };
    const onPause = () => {
      setIsPlaying(false);
      const id = stateRef.current.currentId;
      const st = playStartRef.current;
      playStartRef.current = null;
      if (id && st) recordListen(id, Date.now() - st);
      if (id) saveMeta("position", { id, time: engine.el.currentTime }).catch(() => undefined);
    };
    const onMeta = () => {
      const d = engine.el.duration || 0;
      setDuration(d);
      const tr = trackRef.current;
      if (tr && tr.duration === 0 && d > 0) updateTrack(tr.id, { duration: d });
    };
    engine.el.addEventListener("play", onPlay);
    engine.el.addEventListener("pause", onPause);
    engine.el.addEventListener("loadedmetadata", onMeta);
    return () => {
      engine.onTime = null;
      engine.onEnded = null;
      engine.el.removeEventListener("play", onPlay);
      engine.el.removeEventListener("pause", onPause);
      engine.el.removeEventListener("loadedmetadata", onMeta);
    };
  }, [handleEnded, updateTrack, recordPlay, recordListen]);

  /* ---------- загрузка настроек ---------- */
  useEffect(() => {
    (async () => {
      try {
        const [v, sp, rep, sh, eqs, acc, mut, tid, tEnd] = await Promise.all([
          loadMeta<number>("volume"),
          loadMeta<number>("speed"),
          loadMeta<RepeatMode>("repeat"),
          loadMeta<boolean>("shuffle"),
          loadMeta<EqState>("eq"),
          loadMeta<string>("accent"),
          loadMeta<boolean>("muted"),
          loadMeta<string>("currentId"),
          loadMeta<number>("timerEnd"),
        ]);
        if (v !== undefined) setVolume(v);
        if (sp !== undefined) setSpeed(sp);
        if (rep) setRepeat(rep);
        if (sh !== undefined) setShuffle(sh);
        if (eqs) setEq(eqs);
        if (acc) setAccent(acc);
        if (mut !== undefined) setMuted(mut);
        if (tid) setCurrentId(tid);
        if (tEnd && tEnd > Date.now()) setTimerEnd(tEnd);
      } catch {
        /* нет сохранённых настроек */
      }
    })();
  }, []);

  /* ---------- загрузка трека: папка (volna://) или файл из IndexedDB ---------- */
  useEffect(() => {
    const tr = trackRef.current;
    if (!tr) {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      let url: string;
      if (tr.path && window.volna) {
        url = `volna://local/${encodeURIComponent(tr.path)}`;
      } else {
        const blob = await getStoredBlob(tr.id);
        if (cancelled || !blob) return;
        url = URL.createObjectURL(blob);
      }
      if (cancelled) {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        return;
      }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setTime(0);
      engine.load(url);
      saveMeta("currentId", tr.id).catch(() => undefined);
      const restore = () => {
        engine.el.removeEventListener("loadedmetadata", restore);
        if (cancelled) return;
        loadMeta<{ id: string; time: number }>("position")
          .then((pos) => {
            if (pos && pos.id === tr.id && pos.time > 5) {
              engine.seek(Math.min(pos.time, engine.el.duration || pos.time));
              setTime(pos.time);
            }
          })
          .catch(() => undefined);
        if (pendingPlayRef.current) {
          pendingPlayRef.current = false;
          engine.play();
        }
      };
      engine.el.addEventListener("loadedmetadata", restore);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id]);

  /* ---------- применение настроек к движку ---------- */
  useEffect(() => {
    engine.setVolume(volume);
    saveMeta("volume", volume).catch(() => undefined);
  }, [volume]);
  useEffect(() => {
    engine.setMuted(muted);
    saveMeta("muted", muted).catch(() => undefined);
  }, [muted]);
  useEffect(() => {
    engine.setSpeed(speed);
    saveMeta("speed", speed).catch(() => undefined);
  }, [speed]);
  useEffect(() => {
    saveMeta("repeat", repeat).catch(() => undefined);
  }, [repeat]);
  useEffect(() => {
    saveMeta("shuffle", shuffle).catch(() => undefined);
  }, [shuffle]);
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accent);
    saveMeta("accent", accent).catch(() => undefined);
  }, [accent]);

  /* ---------- громкость каждого трека (0..2) ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("volna-gains");
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>;
        // старые значения могли быть до 200% — приводим к 0..1 (0..100%)
        for (const k of Object.keys(parsed)) {
          if (typeof parsed[k] === "number") parsed[k] = Math.min(1, Math.max(0, parsed[k]));
        }
        setTrackGains(parsed);
      }
    } catch {
      /* нет данных */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("volna-gains", JSON.stringify(trackGains));
    } catch {
      /* квота */
    }
  }, [trackGains]);
  const handleTrackGain = useCallback((id: string, v: number) => {
    setTrackGains((prev) => {
      const next = { ...prev, [id]: v };
      if (v === 1) delete next[id];
      return next;
    });
  }, []);
  const currentGain = currentTrack ? (trackGains[currentTrack.id] ?? 1) : 1;
  useEffect(() => {
    engine.setTrackGain(currentGain);
  }, [currentGain]);

  /* ---------- темы, обои, CSS-код ---------- */
  const theme = useMemo(() => THEMES.find((t) => t.id === themeId) ?? THEMES[0], [themeId]);

  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem("volna-theme-v1");
        if (raw) {
          const s = JSON.parse(raw) as {
            themeId?: string;
            dim?: number;
            blur?: number;
            css?: string;
            cssEnabled?: boolean;
          };
          if (s.themeId && THEMES.some((t) => t.id === s.themeId)) setThemeId(s.themeId);
          if (typeof s.dim === "number") setWallDim(s.dim);
          if (typeof s.blur === "number") setWallBlur(s.blur);
          if (typeof s.css === "string") setCustomCss(s.css);
          if (typeof s.cssEnabled === "boolean") setCssEnabled(s.cssEnabled);
        }
        const w = await loadMeta<string>("wallpaper");
        if (w) setWallpaper(w);
      } catch {
        /* нет сохранённой темы */
      }
    })();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "volna-theme-v1",
        JSON.stringify({ themeId, dim: wallDim, blur: wallBlur, css: customCss, cssEnabled })
      );
    } catch {
      /* квота */
    }
  }, [themeId, wallDim, wallBlur, customCss, cssEnabled]);

  useEffect(() => {
    saveMeta("wallpaper", wallpaper).catch(() => undefined);
  }, [wallpaper]);

  const pickTheme = useCallback(
    (id: string) => {
      const t = THEMES.find((x) => x.id === id);
      if (!t) return;
      setThemeId(id);
      document.documentElement.style.removeProperty("--accent");
      setAccent(t.vars["--accent"] ?? "#8b5cf6");
      pushToast("🎨", `Тема: ${t.name}`);
    },
    [pushToast]
  );

  const randomTheme = useCallback(() => {
    const others = THEMES.filter((t) => t.id !== themeId);
    const pick = others[Math.floor(Math.random() * others.length)];
    if (pick) pickTheme(pick.id);
  }, [themeId, pickTheme]);

  const resetTheme = useCallback(() => {
    pickTheme("volna");
    setWallpaper(null);
    setWallDim(0.35);
    setWallBlur(0);
    setCustomCss("");
    setCssEnabled(true);
    pushToast("🧹", "Тема и стили сброшены");
  }, [pickTheme, pushToast]);

  const onWallpaperFile = useCallback(
    (f: File) => {
      if (!f.type.startsWith("image/")) {
        pushToast("🖼", "Нужен файл картинки (PNG/JPG/GIF/WebP)");
        return;
      }
      const r = new FileReader();
      r.onload = () => {
        setWallpaper(r.result as string);
        pushToast("🖼", f.type === "image/gif" ? "Обои установлены · GIF ожил 🎞" : "Обои установлены");
      };
      r.readAsDataURL(f);
    },
    [pushToast]
  );

  const onWallpaperUrl = useCallback(
    (u: string) => {
      setWallpaper(u);
      pushToast("🖼", u.toLowerCase().includes(".gif") ? "Обои по ссылке · GIF ожил 🎞" : "Обои по ссылке установлены");
    },
    [pushToast]
  );

  const applyEq = useCallback((n: EqState) => {
    setEq(n);
    engine.setEQGains(n.enabled ? n.gains : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    saveMeta("eq", n).catch(() => undefined);
  }, []);

  /* ---------- таймер сна ---------- */
  useEffect(() => {
    if (timerEnd === null) return;
    const id = setInterval(() => {
      if (Date.now() >= timerEnd) {
        setTimerEnd(null);
        saveMeta("timerEnd", null).catch(() => undefined);
        engine.pause();
        setIsPlaying(false);
        pushToast("⏰", "Таймер сна сработал — музыка остановлена");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [timerEnd, pushToast]);

  const timerLeft = timerEnd === null ? null : Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));

  /* ---------- импорт ---------- */
  const importFiles = useCallback(
    async (files: File[]) => {
      const audio = files.filter(isAudioFile);
      if (!audio.length) {
        pushToast("🎵", "В выборе нет аудиофайлов");
        return;
      }
      const n = await addFiles(audio);
      if (n > 0) pushToast("🎵", `Добавлено: ${n} ${plural(n, ["трек", "трека", "треков"])}`);
      else pushToast("✅", "Всё это уже есть в библиотеке");
    },
    [addFiles, pushToast]
  );

  const handlePickFolder = useCallback(async () => {
    if (window.volna) {
      const res = await window.volna.pickFolder();
      if (res) {
        const n = await applyScanLocal(res);
        pushToast(
          "📁",
          n > 0
            ? `Папка «${res.name}»: добавлено ${n} ${plural(n, ["трек", "трека", "треков"])}`
            : `Папка «${res.name}» синхронизирована`
        );
        setSidebarOpen(false);
      }
      return;
    }
    folderInputRef.current?.click();
  }, [applyScanLocal, pushToast]);

  const handleRescan = useCallback(async () => {
    const n = await rescanFolder();
    pushToast("🔄", n > 0 ? `Новых треков: ${n}` : "Всё актуально, новых нет");
  }, [rescanFolder, pushToast]);

  const handleRemove = useCallback(
    (id: string) => {
      const t = tracks.find((x) => x.id === id);
      removeTrack(id);
      pl.removeTrackFromAll(id);
      setQueueIds((prev) => prev.filter((x) => x !== id));
      pushToast("🗑", `Удалено: ${t?.title || "трек"}`);
      if (stateRef.current.currentId === id) {
        const q = stateRef.current.queue;
        const idx = q.findIndex((x) => x.id === id);
        const nxt = q[idx + 1] ?? (q.length > 1 ? q[idx - 1] : null);
        if (nxt && nxt.id !== id) playTrack(nxt);
        else {
          pendingPlayRef.current = false;
          engine.pause();
          setCurrentId(null);
          setIsPlaying(false);
          setTime(0);
        }
      }
    },
    [tracks, removeTrack, pushToast, playTrack]
  );

  /* ---------- горячие клавиши ---------- */
  const hotRef = useRef({
    togglePlay,
    next,
    prev,
    seekBy,
    changeVolume,
    toggleMute,
    openFiles: () => fileInputRef.current?.click(),
    focusSearch: () => searchRef.current?.focus(),
  });
  hotRef.current = {
    togglePlay,
    next,
    prev,
    seekBy,
    changeVolume,
    toggleMute,
    openFiles: () => fileInputRef.current?.click(),
    focusSearch: () => searchRef.current?.focus(),
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
      const h = hotRef.current;
      if (e.code === "Space") {
        e.preventDefault();
        h.togglePlay();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        h.seekBy(5);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        h.seekBy(-5);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        h.changeVolume(Math.min(1, volume + 0.05));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        h.changeVolume(Math.max(0, volume - 0.05));
      } else if (e.key === "m" || e.key === "M" || e.key === "ь" || e.key === "Ь") {
        h.toggleMute();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "o" || e.key === "O" || e.key === "у" || e.key === "У")) {
        e.preventDefault();
        h.openFiles();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K" || e.key === "л" || e.key === "Л")) {
        e.preventDefault();
        h.focusSearch();
      } else if (e.key === "n" || e.key === "N" || e.key === "т" || e.key === "Т") {
        h.next();
      } else if (e.key === "p" || e.key === "P" || e.key === "з" || e.key === "З") {
        h.prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- MediaSession ---------- */
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist || "Неизвестный исполнитель",
      album: currentTrack.album || "Волна",
    });
    const h = hotRef.current;
    navigator.mediaSession.setActionHandler("play", () => h.togglePlay());
    navigator.mediaSession.setActionHandler("pause", () => h.togglePlay());
    navigator.mediaSession.setActionHandler("previoustrack", () => h.prev());
    navigator.mediaSession.setActionHandler("nexttrack", () => h.next());
    navigator.mediaSession.setActionHandler("seekto", (d) => {
      if (d.seekTime != null) engine.seek(d.seekTime);
    });
  }, [currentTrack]);

  /* ---------- title вкладки ---------- */
  useEffect(() => {
    document.title = currentTrack ? `${currentTrack.title} — Волна` : "Волна — музыкальный плеер";
  }, [currentTrack]);

  /* ---------- защита от открытия файлов браузером ---------- */
  useEffect(() => {
    const prevent = (e: globalThis.DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const handleSort = (k: SortKey) => {
    if (sort === k) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(k);
      setSortDir(1);
    }
  };

  const cycleRepeat = () => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"));
  const cycleSpeed = () => setSpeed((prev) => SPEEDS[(SPEEDS.indexOf(prev) + 1) % SPEEDS.length]);

  /* ---------- виды библиотеки ---------- */
  const goLibrary = useCallback(() => {
    setFavOnly(false);
    setRecentOpen(false);
    pl.setActiveId(null);
    setAlbumKey(null);
  }, [pl]);
  const goFav = useCallback(() => {
    setFavOnly(true);
    setRecentOpen(false);
    pl.setActiveId(null);
    setAlbumKey(null);
  }, [pl]);
  const goRecent = useCallback(() => {
    setFavOnly(false);
    setRecentOpen(true);
    pl.setActiveId(null);
    setAlbumKey(null);
  }, [pl]);

  /* ---------- мини-плеер (Electron) ---------- */
  const openMini = useCallback(() => {
    if (window.volna) {
      window.volna.miniOpen();
      pushToast("🪟", "Мини-плеер открыт");
    } else {
      pushToast("🪟", "Мини-плеер доступен в Windows-приложении");
    }
  }, [pushToast]);

  useEffect(() => {
    if (!window.volna) return;
    const send = () => {
      const t = trackRef.current;
      const art = t?.coverHash && window.volna ? `volna://cover/${t.coverHash}` : null;
      window.volna!.sendMiniState({
        title: t?.title ?? "",
        artist: t?.artist ?? "",
        art,
        playing: stateRef.current.isPlaying,
      });
    };
    send();
    const id = setInterval(send, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!window.volna) return;
    return window.volna.onRendererCommand((cmd) => {
      if (cmd === "toggle") togglePlay();
      else if (cmd === "next") next();
      else if (cmd === "prev") prev();
    });
  }, [togglePlay, next, prev]);

  /* ---------- Discord Rich Presence ---------- */
  useEffect(() => {
    if (!window.volna) return;
    const v = localStorage.getItem("volna-rpc");
    if (v !== null) setRpcOn(v !== "off");
  }, []);
  useEffect(() => {
    if (!window.volna) return;
    window.volna.setRpcEnabled(rpcOn);
    localStorage.setItem("volna-rpc", rpcOn ? "on" : "off");
  }, [rpcOn]);
  useEffect(() => {
    if (!window.volna) return;
    const send = () => {
      const t = trackRef.current;
      const remaining = t && t.duration > 0 ? Math.max(0, t.duration - engine.el.currentTime) : 0;
      window.volna!.rpcUpdate({
        title: t?.title ?? "",
        artist: t?.artist ?? "",
        playing: stateRef.current.isPlaying,
        end: stateRef.current.isPlaying && remaining > 0 ? Date.now() + remaining * 1000 : null,
      });
    };
    send();
    const id = setInterval(send, 15000);
    return () => clearInterval(id);
  }, [currentTrack?.id, isPlaying]);

  const openTrackMenu = useCallback((e: { clientX: number; clientY: number; preventDefault: () => void }, t: Track) => {
    e.preventDefault();
    setMenuTrack({ track: t, x: e.clientX, y: e.clientY });
  }, []);

  const onDragEnter = (e: ReactDragEvent) => {
    e.preventDefault();
    dragDepthRef.current++;
    setDragOver(true);
  };
  const onDragLeave = () => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (!dragDepthRef.current) setDragOver(false);
  };
  const onDrop = (e: ReactDragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) importFiles(files);
  };

  const totalDur = tracks.reduce((s, t) => s + t.duration, 0);
  const hour = new Date().getHours();
  const greet = hour < 5 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

  const currentSortLabel = SORT_OPTIONS.find((s) => s.key === sort)?.label ?? "Сортировка";

  return (
    <div
      className="relative flex h-dvh flex-col overflow-hidden"
      data-theme={themeId}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {/* тема: CSS-переменные + пользовательский CSS-код (побеждает темы) */}
      <style id="volna-theme">{themeCss(theme)}</style>
      <style id="volna-css">{cssEnabled ? customCss : ""}</style>

      {/* системный заголовок Windows (свернуть/развернуть/закрыть) */}
      <div className="min-h-0 flex-1">
        {/* слой фона темы */}
        <div className="bg-app absolute inset-0" />

        {/* обои (поддерживают анимированные GIF) — поверх фона, под контентом */}
        {wallpaper && (
          <>
            <div
              className="pointer-events-none absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url("${wallpaper}")` }}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `rgba(5,7,12,${wallDim})`,
                backdropFilter: wallBlur > 0 ? `blur(${wallBlur}px)` : undefined,
              }}
            />
          </>
        )}

        <div className="relative z-10 grid h-full min-h-0 grid-rows-[1fr_auto] lg:grid-cols-[248px_1fr]">
      {/* затемнение под выдвижным меню */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        favOnly={favOnly}
        recentOpen={recentOpen}
        onLibrary={goLibrary}
        onFav={goFav}
        onRecent={goRecent}
        onOpenStats={() => setStatsOpen(true)}
        onAddFiles={() => fileInputRef.current?.click()}
        onAddFolder={handlePickFolder}
        onOpenThemes={() => setThemesOpen(true)}
        onOpenEq={() => setModal((m) => ({ ...m, eq: true }))}
        onOpenTimer={() => setModal((m) => ({ ...m, timer: true }))}
        onOpenDownload={() => setDlOpen(true)}
        onOpenCredits={() => setCreditsOpen(true)}
        rpcOn={rpcOn}
        onToggleRpc={() => setRpcOn((r) => !r)}
        count={tracks.length}
        total={totalDur}
        timerLeft={timerLeft}
        accent={accent}
        onAccent={setAccent}
        folderName={folder?.name ?? null}
        folderScanning={folderScanning}
        onRescan={handleRescan}
        onOpenFolder={openFolderInExplorer}
        playlists={playlists.map(({ id, name, trackIds }) => ({ id, name, count: trackIds.length }))}
        activePlaylistId={activePlaylistId}
        onCreatePlaylist={pl.create}
        onSelectPlaylist={pl.setActiveId}
        onDeletePlaylist={pl.remove}
      />

      <main className="row-start-1 flex min-h-0 flex-col lg:col-start-2">
        <header className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-4 sm:gap-3 sm:px-6 sm:pt-5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-xl bg-white/[0.06] p-2.5 text-white/60 transition-all hover:bg-white/[0.12] hover:text-white lg:hidden"
            aria-label="Открыть меню"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/35">{greet}</div>
            <h1 className="font-display mt-1 flex items-center gap-3 truncate text-xl font-bold sm:text-2xl">
              <span className="truncate">
                {albumGroup
                  ? albumGroup.name
                  : activePlaylist
                    ? activePlaylist.name
                    : recentOpen
                      ? "Недавние"
                      : favOnly
                        ? "Избранное"
                        : "Библиотека"}
              </span>
              {albumGroup ? (
                <button
                  onClick={() => setAlbumKey(null)}
                  className="shrink-0 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-white/50 transition-colors hover:bg-white/[0.12] hover:text-white"
                  title="Назад к альбомам"
                >
                  ← все альбомы
                </button>
              ) : activePlaylist ? (
                <button
                  onClick={() => pl.setActiveId(null)}
                  className="shrink-0 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-white/50 transition-colors hover:bg-white/[0.12] hover:text-white"
                  title="Выйти из плейлиста"
                >
                  ✕ выйти
                </button>
              ) : null}
              <span className="shrink-0 align-middle text-[11px] font-semibold text-white/35 sm:text-xs">
                {visibleTracks.length} {plural(visibleTracks.length, ["трек", "трека", "треков"])} ·{" "}
                {formatTotal(visibleTracks.reduce((s, t) => s + t.duration, 0))}
              </span>
            </h1>
          </div>
          {!albumKey && (
            <button
              onClick={() => setViewMode((v) => (v === "list" ? "albums" : "list"))}
              className="glass hidden items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-bold text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white sm:flex"
              title={viewMode === "list" ? "Показать альбомами" : "Показать списком"}
            >
              {viewMode === "list" ? <IconGrid className="h-4 w-4" /> : <IconList className="h-4 w-4" />}
              <span className="hidden md:inline">{viewMode === "list" ? "Альбомы" : "Список"}</span>
            </button>
          )}

          {/* сортировка */}
          <div className="relative">
            <button
              onClick={() => setSortOpen((o) => !o)}
              className={`glass flex items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-bold transition-colors hover:bg-white/[0.08] hover:text-white ${
                sort !== "order" ? "text-[var(--accent)]" : "text-white/70"
              }`}
              title="Сортировка"
            >
              <IconSort className="h-4 w-4" />
              <span className="hidden max-w-[130px] truncate md:inline">{currentSortLabel}</span>
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
                <div className="bg-panel absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-white/10 p-1.5 shadow-2xl backdrop-blur-xl">
                  {SORT_OPTIONS.map((o) => {
                    const active = sort === o.key;
                    return (
                      <button
                        key={o.key}
                        onClick={() => {
                          if (active) {
                            if (o.key !== "order") setSortDir((d) => (d === 1 ? -1 : 1));
                          } else {
                            setSort(o.key);
                            setSortDir(1);
                          }
                          setSortOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold transition-colors ${
                          active ? "bg-white/[0.07] text-white" : "text-white/60 hover:bg-white/[0.05] hover:text-white"
                        }`}
                      >
                        <span className={active ? "text-[var(--accent)]" : "text-white/25"}>{o.label}</span>
                        <span className="ml-auto text-[10px] font-bold text-[var(--accent)]">
                          {active ? (o.key === "order" ? "порядок" : sortDir === 1 ? "↑" : "↓") : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <div className="relative">
            <IconSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск… (Ctrl+K)"
              className="glass w-32 rounded-full py-2.5 pl-10 pr-3 text-sm font-medium text-white placeholder-white/30 outline-none transition-all focus:w-40 focus:border-[var(--accent)]/50 focus:bg-white/[0.07] sm:w-48 sm:focus:w-64 lg:w-60 lg:focus:w-80"
            />
          </div>
          <button
            onClick={handlePickFolder}
            className="glass hidden items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white lg:flex"
          >
            <IconFolder className="h-4 w-4" />
            Папка
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95 sm:px-4"
            style={{
              background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #22d3ee))",
              boxShadow: "0 6px 20px -8px var(--accent)",
            }}
          >
            <IconPlus className="h-4 w-4" strokeWidth={3} />
            <span className="hidden sm:inline">Файлы</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 px-2 pb-3 sm:px-3">
          {ready && !tracks.length ? (
            <EmptyState onAddFiles={() => fileInputRef.current?.click()} onAddFolder={handlePickFolder} />
          ) : viewMode === "albums" && !albumGroup ? (
            <AlbumsGrid groups={albumGroups} onOpen={setAlbumKey} />
          ) : (
            <Playlist
              tracks={albumGroup ? albumGroup.tracks : visibleTracks}
              currentId={currentId}
              isPlaying={isPlaying}
              onPlay={playTrack}
              onFav={toggleFav}
              onRemove={handleRemove}
              onReorder={(from, to) => {
                if (activePlaylist) {
                  pl.moveTrack(activePlaylist.id, visibleTracks[from].id, visibleTracks[to].id);
                } else {
                  reorder(from, to, visibleTracks);
                }
              }}
              onTrackMenu={(e, t) => openTrackMenu(e, t)}
              sort={sort}
              sortDir={sortDir}
              onSort={handleSort}
              emptyText={
                albumGroup
                  ? "В альбоме нет треков"
                  : activePlaylist
                    ? "Плейлист пуст — добавьте треки через меню трека (клик по названию внизу)"
                    : recentOpen
                      ? "Ещё ничего не слушали — просто включите музыку"
                      : undefined
              }
            />
          )}
        </div>
      </main>

      <PlayerBar
        track={currentTrack}
        isPlaying={isPlaying}
        time={time}
        duration={duration}
        onToggle={togglePlay}
        onNext={next}
        onPrev={prev}
        onSeek={seekTo}
        volume={volume}
        muted={muted}
        onVolume={changeVolume}
        onMute={toggleMute}
        speed={speed}
        onSpeed={cycleSpeed}
        repeat={repeat}
        onRepeat={cycleRepeat}
        shuffle={shuffle}
        onShuffle={() => setShuffle((s) => !s)}
        onOpenNow={() => setModal((m) => ({ ...m, now: true }))}
        onOpenEq={() => setModal((m) => ({ ...m, eq: true }))}
        onOpenTimer={() => setModal((m) => ({ ...m, timer: true }))}
        gain={currentGain}
        onGain={(v) => currentTrack && handleTrackGain(currentTrack.id, v)}
        onOpenExplorer={(t) => {
          if (window.volna && t.path) window.volna.openInExplorer(t.path);
        }}
        onRemoveTrack={(t) => handleRemove(t.id)}
        onOpenMini={openMini}
        queueCount={queueIds.length}
        onOpenQueue={() => setQueueOpen(true)}
        onQueueTrack={() => {
          if (!currentTrack) return;
          setQueueIds((prev) => (prev.includes(currentTrack.id) ? prev : [...prev, currentTrack.id]));
          pushToast("📃", "Добавлено в очередь");
        }}
        playlists={playlists.map(({ id, name }) => ({ id, name }))}
        onAddToPlaylist={(plId) => {
          if (!currentTrack) return;
          pl.addTrack(plId, currentTrack.id);
          pushToast("🎶", `Добавлено в «${playlists.find((x) => x.id === plId)?.name ?? ""}»`);
        }}
        onRemoveFromPlaylist={
          activePlaylist && currentTrack && activePlaylist.trackIds.includes(currentTrack.id)
            ? () => {
                pl.removeTrack(activePlaylist.id, currentTrack.id);
                pushToast("🎶", "Убрано из плейлиста");
              }
            : null
        }
        timerLeft={timerLeft}
        eqOn={eq.enabled}
        onFav={toggleFav}
      />

      {modal.now && currentTrack && (
        <NowPlaying
          track={currentTrack}
          isPlaying={isPlaying}
          time={time}
          duration={duration}
          onSeek={seekTo}
          onToggle={togglePlay}
          onNext={next}
          onPrev={prev}
          onClose={() => setModal((m) => ({ ...m, now: false }))}
          shuffle={shuffle}
          onShuffle={() => setShuffle((s) => !s)}
          repeat={repeat}
          onRepeat={cycleRepeat}
          speed={speed}
          onSpeed={cycleSpeed}
          onFav={toggleFav}
          gain={currentGain}
          onGain={(v) => handleTrackGain(currentTrack.id, v)}
          accent={accent}
        />
      )}

      {modal.eq && (
        <Equalizer
          eq={eq}
          onToggle={() => applyEq({ ...eq, enabled: !eq.enabled })}
          onChange={(i, v) => {
            const gains = [...eq.gains];
            gains[i] = v;
            applyEq({ ...eq, gains, preset: "Свой" });
          }}
          onPreset={(name, gains) => applyEq({ ...eq, gains, preset: name })}
          onClose={() => setModal((m) => ({ ...m, eq: false }))}
        />
      )}

      {modal.timer && (
        <SleepTimer
          end={timerEnd}
          onSet={(min) => {
            const end = Date.now() + min * 60000;
            setTimerEnd(end);
            saveMeta("timerEnd", end).catch(() => undefined);
            pushToast("⏰", `Таймер сна: ${min} мин`);
            setModal((m) => ({ ...m, timer: false }));
          }}
          onCancel={() => {
            setTimerEnd(null);
            saveMeta("timerEnd", null).catch(() => undefined);
            pushToast("✅", "Таймер отменён");
          }}
          onClose={() => setModal((m) => ({ ...m, timer: false }))}
        />
      )}

      {creditsOpen && <CreditsModal onClose={() => setCreditsOpen(false)} />}

      {dlOpen && (
        <DownloadModal
          onClose={() => setDlOpen(false)}
          onDone={(d) => {
            addExternalTrack(d);
            pushToast("⬇️", `Скачано: ${d.title}`);
            setDlOpen(false);
          }}
        />
      )}

      {statsOpen && <StatsModal stats={stats} tracks={tracks} onClose={() => setStatsOpen(false)} />}

      {menuTrack && (
        <TrackMenu
          track={menuTrack.track}
          x={menuTrack.x}
          y={menuTrack.y}
          onClose={() => setMenuTrack(null)}
          playlists={playlists.map(({ id, name }) => ({ id, name }))}
          activePlaylist={activePlaylist ? { id: activePlaylist.id, name: activePlaylist.name } : null}
          isInActivePlaylist={
            activePlaylist ? activePlaylist.trackIds.includes(menuTrack.track.id) : false
          }
          onPlay={playTrack}
          onPlayNext={playNext}
          onQueue={queueTrack}
          onAddToPlaylist={(t, plId) => {
            pl.addTrack(plId, t.id);
            pushToast("🎶", `Добавлено в «${playlists.find((x) => x.id === plId)?.name ?? ""}»`);
          }}
          onAddToActive={(t) => {
            if (!activePlaylist) return;
            pl.addTrack(activePlaylist.id, t.id);
            pushToast("🎶", `Добавлено в «${activePlaylist.name}»`);
          }}
          onToggleFav={(t) => toggleFav(t.id)}
          onOpenNow={(t) => {
            if (t.id !== currentId) playTrack(t);
            setModal((m) => ({ ...m, now: true }));
          }}
          onOpenExplorer={(t) => {
            if (window.volna && t.path) window.volna.openInExplorer(t.path);
          }}
          onRemoveFromPlaylist={(t) => {
            if (activePlaylist) pl.removeTrack(activePlaylist.id, t.id);
          }}
          onRemove={(t) => handleRemove(t.id)}
        />
      )}

      {queueOpen && (
        <QueueModal
          queue={queueIds
            .map((id) => tracks.find((t) => t.id === id))
            .filter((t): t is Track => Boolean(t))}
          onPlay={(t) => {
            playTrack(t);
            setQueueOpen(false);
          }}
          onRemove={(id) => setQueueIds((prev) => prev.filter((x) => x !== id))}
          onClear={() => setQueueIds([])}
          onClose={() => setQueueOpen(false)}
        />
      )}

      {themesOpen && (
        <ThemesModal
          themeId={themeId}
          onTheme={pickTheme}
          onRandom={randomTheme}
          wallpaper={wallpaper}
          onWallpaperFile={onWallpaperFile}
          onWallpaperUrl={onWallpaperUrl}
          onWallpaperClear={() => setWallpaper(null)}
          wallDim={wallDim}
          onWallDim={setWallDim}
          wallBlur={wallBlur}
          onWallBlur={setWallBlur}
          customCss={customCss}
          onCss={setCustomCss}
          cssEnabled={cssEnabled}
          onCssEnabled={setCssEnabled}
          onReset={resetTheme}
          onClose={() => setThemesOpen(false)}
        />
      )}

      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-[2rem] border-2 border-dashed border-[var(--accent)] bg-[#0c1018]/60 px-16 py-12 text-center">
            <div className="text-5xl">🎵</div>
            <div className="font-display mt-4 text-xl font-bold">Отпустите — добавим в библиотеку</div>
            <div className="mt-2 text-sm font-medium text-white/50">MP3 · FLAC · WAV · OGG · M4A · AAC · OPUS</div>
          </div>
        </div>
      )}

      <Toasts toasts={toasts} />

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.flac,.wav,.ogg,.oga,.m4a,.aac,.opus,.webm,.wma"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) importFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: "true" } as object)}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) importFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      </div>
      </div>
    </div>
  );
}
