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
  /** Открыть папку файла в проводнике */
  openInExplorer: (path) => ipcRenderer.invoke("open-folder", path),
  /** ---- мини-плеер ---- */
  miniOpen: () => ipcRenderer.invoke("mini-open"),
  miniCommand: (cmd) => ipcRenderer.send("mini-command", cmd),
  sendMiniState: (state) => ipcRenderer.send("mini-state", state),
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
  /** ---- Discord Rich Presence ---- */
  rpcUpdate: (data) => ipcRenderer.send("rpc-update", data),
  setRpcEnabled: (on) => ipcRenderer.send("rpc-enabled", on),
  /** ---- скачивание аудио (yt-dlp) ---- */
  dlStart: (url) => ipcRenderer.invoke("dl-download", url),
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
