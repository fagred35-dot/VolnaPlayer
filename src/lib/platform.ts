import { Capacitor } from "@capacitor/core";

/**
 * Определение среды запуска.
 * - electron: десктопная сборка (мост window.volna из preload.js)
 * - mobile:   Capacitor (Android/iOS) — мост ставит src/mobile/bridge.ts
 * - web:      обычный браузер (только IndexedDB-треки)
 */
export function isMobilePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Мост window.volna присутствует и это именно Electron (не мобильный полифилл) */
export function isElectronVolna(): boolean {
  return !!window.volna && !isMobilePlatform();
}

/** Разделитель путей текущей платформы */
export function pathSep(): string {
  return isElectronVolna() ? "\\" : "/";
}

/**
 * URL для воспроизведения файла по абсолютному пути.
 * Electron: собственный протокол volna://local/...
 * Capacitor: конвертация в URL, доступный WebView (через локальный сервер)
 */
export function trackSrc(path: string): string {
  if (isElectronVolna()) return `volna://local/${encodeURIComponent(path)}`;
  return window.volna?.fileUrl?.(path) ?? `file://${path}`;
}
