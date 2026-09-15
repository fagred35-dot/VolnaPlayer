import { registerPlugin } from "@capacitor/core";
import type { DeviceAudioTrack } from "../electron.d";

/**
 * Нативный плагин синхронизации и системных функций (Android):
 * сеть, MediaStore, версия сборки, crash-лог, обои из обложки,
 * UDP-поиск ПК. На вебе вызовы упадут — вызывающий код обязан
 * оборачивать в try/catch.
 */
export interface SyncPluginInterface {
  getIp(): Promise<{ ip: string | null }>;
  /** Вся аудиобиблиотека устройства через MediaStore (Android) */
  listAudio(): Promise<{ tracks: DeviceAudioTrack[] }>;
  /** Версия сборки из PackageManager (versionName + versionCode) */
  getAppVersion(): Promise<{ version: string; build: number }>;
  /** Текст последнего нативного сбоя (files/crash-last.txt) */
  getCrashLog(): Promise<{ text: string }>;
  clearCrashLog(): Promise<{ ok: boolean }>;
  /** Поставить кадр обложки как обои: target = "system" | "lock" | "both" */
  setWallpaper(opts: { path: string; target: string }): Promise<{ ok: boolean; error?: string }>;
  /** Вернуть стандартные обои из бэкапа (на паузе/остановке) */
  restoreWallpaper(): Promise<{ ok: boolean; restored: boolean }>;
  /** Слушать UDP-анонсы ПК на порту 51789 */
  startDiscovery(): Promise<{ ok: boolean; error?: string }>;
  getDiscovered(): Promise<{ pc?: { ip: string; port: number; deviceId: string; name: string; seenAt: number } }>;
  stopDiscovery(): Promise<void>;
  /** Сохранить файл в Downloads через MediaStore (запасной экспорт библиотеки) */
  exportFile(opts: { name: string; base64: string; mime?: string }): Promise<{ ok: boolean; error?: string }>;
}

export const SyncPlugin = registerPlugin<SyncPluginInterface>("SyncPlugin");
