export interface FolderFile {
  rel: string;
  size: number;
  mtimeMs: number;
}

export interface FolderScan {
  path: string;
  name: string;
  files: FolderFile[];
}

export interface TagInfo {
  title: string | null;
  artist: string | null;
  album: string | null;
  duration: number;
  coverHash: string | null;
}

export interface MiniPlayerState {
  title: string;
  artist: string;
  art: string | null;
  playing: boolean;
}

declare global {
  interface Window {
    volna?: {
      platform: string;
      pickFolder: () => Promise<FolderScan | null>;
      scanFolder: (path: string) => Promise<FolderScan | null>;
      getTags: (paths: string[]) => Promise<Record<string, TagInfo | undefined>>;
      openInExplorer: (path: string) => Promise<void>;
      /** мини-плеер */
      miniOpen: () => Promise<void>;
      miniCommand: (cmd: string) => void;
      sendMiniState: (state: MiniPlayerState) => void;
      onRendererCommand: (cb: (cmd: string) => void) => () => void;
      onMiniState: (cb: (state: MiniPlayerState) => void) => () => void;
      /** кастомный titlebar */
      windowControls: (action: "minimize" | "maximize" | "close") => void;
      onWindowState: (cb: (maximized: boolean) => void) => () => void;
      isMaximized: () => Promise<boolean>;
      /** Discord Rich Presence */
      rpcUpdate: (d: { title: string; artist: string; playing: boolean; end?: number | null }) => void;
      setRpcEnabled: (on: boolean) => void;
      /** скачивание аудио по ссылке (yt-dlp); destDir — папка, куда сохранить */
      dlStart: (url: string, destDir?: string) => Promise<{ ok: boolean }>;
      onDlProgress: (cb: (p: { percent: number; status: string }) => void) => () => void;
      onDlDone: (
        cb: (d: { path: string; title: string; artist?: string; album?: string; duration?: number; coverHash?: string | null }) => void
      ) => () => void;
      onDlError: (cb: (d: { message: string }) => void) => () => void;
    };
  }
}

export {};
