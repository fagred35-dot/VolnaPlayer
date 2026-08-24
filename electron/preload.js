// Мост между рендерером и main-процессом.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("volna", {
  platform: process.platform,
  /** Нативный диалог выбора папки + список аудиофайлов в ней */
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
  /** Повторное сканирование уже выбранной папки */
  scanFolder: (path) => ipcRenderer.invoke("scan-folder", path),
  /** Теги (название, исполнитель, альбом, длительность, обложка) для файлов */
  getTags: (paths) => ipcRenderer.invoke("get-tags", paths),
  /** Открыть папку файла в проводнике (с выделением файла) */
  openInExplorer: (path) => ipcRenderer.invoke("open-folder", path),
  /** Удалить файл с диска */
  deleteFile: (path) => ipcRenderer.invoke("delete-file", path),
  /** ---- мини-плеер ---- */
  miniOpen: () => ipcRenderer.invoke("mini-open"),
  miniCommand: (cmd) => ipcRenderer.send("mini-command", cmd),
  sendMiniState: (state) => ipcRenderer.send("mini-state", state),
  /** изменить размер окна оверлея (из пресетов вида) */
  miniResize: (w, h) => ipcRenderer.send("mini-resize", w, h),
  /** глобальный хоткей Ctrl+Alt+M — режим перемещения оверлея */
  onMiniMoveMode: (cb) => {
    const l = () => cb();
    ipcRenderer.on("mini-move-mode", l);
    return () => ipcRenderer.removeListener("mini-move-mode", l);
  },
  onRendererCommand: (cb) => {
    const l = (_e, cmd) => cb(cmd);
    ipcRenderer.on("renderer-command", l);
    return () => ipcRenderer.removeListener("renderer-command", l);
  },
  onMiniState: (cb) => {
    const l = (_e, s) => cb(s);
    ipcRenderer.on("mini-state", l);
    return () => ipcRenderer.removeListener("mini-state", l);
  },
  /** ---- кастомный titlebar ---- */
  windowControls: (action) => ipcRenderer.send("window-control", action),
  onWindowState: (cb) => {
    const l = (_e, m) => cb(m);
    ipcRenderer.on("window-state", l);
    return () => ipcRenderer.removeListener("window-state", l);
  },
  isMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  /** ---- прозрачность и размытие основного окна ---- */
  getWindowPrefs: () => ipcRenderer.invoke("get-window-prefs"),
  setWindowPrefs: (patch) => ipcRenderer.invoke("set-window-prefs", patch),
  /** ---- Discord Rich Presence ---- */
  rpcUpdate: (data) => ipcRenderer.send("rpc-update", data),
  setRpcEnabled: (on) => ipcRenderer.send("rpc-enabled", on),
  /** ---- скачивание аудио (yt-dlp) ---- */
  dlStart: (url, destDir) => ipcRenderer.invoke("dl-download", url, destDir),
  /** Поиск треков на YouTube по названию (yt-dlp ytsearch) */
  dlSearch: (query) => ipcRenderer.invoke("dl-search", query),
  /** Метаданные по ссылке (название/обложка/канал), без скачивания */
  dlMeta: (url) => ipcRenderer.invoke("dl-meta", url),
  /** Отменить активное скачивание */
  dlCancel: () => ipcRenderer.invoke("dl-cancel"),
  onDlProgress: (cb) => {
    const l = (_e, p) => cb(p);
    ipcRenderer.on("dl-progress", l);
    return () => ipcRenderer.removeListener("dl-progress", l);
  },
  onDlDone: (cb) => {
    const l = (_e, d) => cb(d);
    ipcRenderer.on("dl-done", l);
    return () => ipcRenderer.removeListener("dl-done", l);
  },
  onDlError: (cb) => {
    const l = (_e, d) => cb(d);
    ipcRenderer.on("dl-error", l);
    return () => ipcRenderer.removeListener("dl-error", l);
  },
});
