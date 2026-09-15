import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.volna.player",
  appName: "Волна",
  webDir: "dist",
  android: {
    // Синхронизация: страница https://localhost ходит на http://ПК в LAN —
    // без этого WebView режет все запросы как mixed content
    allowMixedContent: true,
    // Android 15 (SDK 35+) рисует WebView edge-to-edge — просим отступы под статус/жест-бары
    adjustMarginsForEdgeToEdge: "force",
    backgroundColor: "#0a0d14",
  },
};

export default config;
