// Генерирует иконку приложения (build/icon.ico) из public/volna-icon.png
// Запускается автоматически при сборке: node make-icon.js
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

const src = path.join(__dirname, "..", "dist", "volna-icon.png");
const outDir = path.join(__dirname, "build");
const icoDest = path.join(outDir, "icon.ico");

if (!fs.existsSync(src)) {
  console.error("❌ dist/volna-icon.png не найден. Сначала соберите сайт: npm run build (в корне проекта)");
  process.exit(1);
}

try {
  // electron-icon-builder — CLI из корневого node_modules (npm install в корне проекта)
  const cli = require.resolve("electron-icon-builder");
  execFileSync(process.execPath, [cli, "--input=" + src, "--output=" + outDir], { stdio: "inherit" });

  // CLI кладёт .ico в build/icons/win/ — копируем в build/icon.ico, как ждёт electron-builder
  const winIco = path.join(outDir, "icons", "win", "icon.ico");
  if (!fs.existsSync(winIco)) throw new Error("icon.ico не сгенерирован: " + winIco);
  fs.copyFileSync(winIco, icoDest);
  console.log("✅ Иконки сгенерированы:", icoDest);
} catch (e) {
  console.error("❌ Не удалось сгенерировать иконку:", e.message);
  console.error("   Проверьте, что установлен electron-icon-builder (npm install в корне проекта)");
  process.exit(1);
}