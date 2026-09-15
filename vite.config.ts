import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Версия сборки, доступная в рантайме (src/lib/version.ts)
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")) as { version?: string };

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version ?? ""),
  },
});
