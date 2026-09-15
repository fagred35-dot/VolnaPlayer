import { useCallback, useEffect, useState } from "react";
import { Directory, Filesystem } from "@capacitor/filesystem";
import type { DeviceAudioTrack } from "../electron.d";
import { requestStoragePermission } from "./bridge";
import { appLog } from "../lib/applog";

interface Props {
  open: boolean;
  onClose: () => void;
  /** выбранный каталог — абсолютный путь, сканируется как библиотечная папка */
  onPick: (path: string) => void;
  /** «Вся музыка на устройстве» — список треков из MediaStore */
  onPickAllAudio?: (tracks: DeviceAudioTrack[]) => void;
}

interface Entry {
  name: string;
  path: string;
}

const START = "/storage/emulated/0";

/**
 * Встроенный браузер папок (Android): пользователь сам выбирает каталог
 * с музыкой. Показывает только папки, доступные для чтения.
 */
export default function FolderPicker({ open, onClose, onPick, onPickAllAudio }: Props) {
  const [dir, setDir] = useState(START);
  const [dirs, setDirs] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanningAll, setScanningAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await Filesystem.readdir({ path, directory: Directory.ExternalStorage });
      setDirs(
        res.files
          .filter((f) => f.type === "directory")
          .map((f) => ({ name: f.name, path: `${path.replace(/\/+$/, "")}/${f.name}` }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setDir(path);
    } catch {
      setError("Не удалось открыть папку");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const ok = await requestStoragePermission();
      void ok;
      void load(START);
    })();
  }, [open, load]);

  /** Вся музыка через MediaStore — работает даже там, где листинг папок закрыт */
  const pickAllAudio = useCallback(async () => {
    setScanningAll(true);
    setError(null);
    try {
      const list = (await window.volna?.listAllAudio?.()) ?? [];
      appLog("media", `listAllAudio: ${list.length} tracks`);
      if (!list.length) {
        setError("На устройстве не найдено аудиофайлов");
        return;
      }
      onPickAllAudio?.(list);
      onClose();
    } catch (e) {
      appLog("media", "listAllAudio failed", e instanceof Error ? e.message : String(e));
      setError("Не удалось получить список музыки");
    } finally {
      setScanningAll(false);
    }
  }, [onPickAllAudio, onClose]);

  if (!open) return null;

  const parent = dir === START ? null : dir.replace(/\/[^/]+$/, "") || START;
  const upName = dir.split("/").filter(Boolean).pop() ?? "Память устройства";

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[#0a0d14]/95 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="anim-in mx-auto flex h-full w-full max-w-md flex-col p-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="glass rounded-xl px-3 py-2 text-sm font-bold text-white/70"
            aria-label="Закрыть"
          >
            ✕
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-bold text-white/80">{dir}</div>
        </div>

        <button
          onClick={() => void pickAllAudio()}
          disabled={scanningAll}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          style={{ background: "var(--accent-grad)", boxShadow: "0 8px 24px -8px var(--accent)" }}
        >
          {scanningAll ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <span aria-hidden>🎵</span>
          )}
          {scanningAll ? "Ищем музыку…" : "Вся музыка на устройстве"}
        </button>

        <div className="scroll-thin mt-3 flex-1 space-y-1 overflow-y-auto">
          {parent && (
            <button
              onClick={() => void load(parent)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-white/70 transition-colors hover:bg-white/[0.06]"
            >
              ↩ <span className="truncate">{upName}</span>
            </button>
          )}
          {loading && <div className="px-3 py-4 text-sm text-white/40">Загрузка…</div>}
          {error && <div className="px-3 py-4 text-sm text-red-300/80">{error}</div>}
          {dirs.map((d) => (
            <button
              key={d.path}
              onClick={() => void load(d.path)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.06]"
            >
              <span className="text-lg leading-none">📁</span>
              <span className="truncate">{d.name}</span>
            </button>
          ))}
          {!loading && !error && !dirs.length && parent !== null && (
            <div className="px-3 py-4 text-sm text-white/30">Вложенных папок нет</div>
          )}
        </div>

        <button
          onClick={() => {
            onPick(dir);
            onClose();
          }}
          className="mt-3 w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: "var(--accent-grad)", boxShadow: "0 8px 24px -8px var(--accent)" }}
        >
          Выбрать эту папку
        </button>
      </div>
    </div>
  );
}
