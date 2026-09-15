/**
 * Версия сборки, вшитая на этапе сборки: vite.config.ts подставляет
 * __APP_VERSION__ из package.json (define). В тестах константа не
 * определена — остаётся пустая строка, реальную версию доставит
 * Electron IPC или нативный плагин.
 */
declare const __APP_VERSION__: string;

export const BUILD_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "";
