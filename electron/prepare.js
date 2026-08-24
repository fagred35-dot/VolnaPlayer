// Копирует собранный сайт (../dist) в папку electron/dist перед упаковкой.
// Устойчив к блокировкам Windows: повторные попытки, перезапись без удаления
// всей папки, понятные подсказки при ошибках.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "dist");
const dest = path.join(__dirname, "dist");

if (!fs.existsSync(src)) {
  console.error("❌ Папка ../dist не найдена. Сначала соберите сайт: npm run build (в корне проекта)");
  process.exit(1);
}

// Предупреждаем про кириллицу/пробелы в пути — частая причина проблем в Windows
if (/[а-яА-ЯЁё]/.test(__dirname)) {
  console.warn("⚠️ Внимание: путь содержит кириллицу (C:\\Users\\ВаНя\\...).");
  console.warn("   Если дальше будут ошибки доступа — перенесите проект в путь без кириллицы, например C:\\Volna");
}

// 1) Пробуем удалить старую папку (с повторными попытками — файлы могут быть заняты)
try {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
} catch (e) {
  console.warn("⚠️ Не удалось удалить старую папку electron/dist: " + e.message);
  console.warn("   Пробуем скопировать поверх…");
}

// 2) Копируем с перезаписью (fs.cpSync → при сбое robocopy на Windows)
async function copyDir() {
  fs.mkdirSync(dest, { recursive: true });
  try {
    fs.cpSync(src, dest, { recursive: true, force: true, errorOnExist: false });
    return;
  } catch (e) {
    if (process.platform !== "win32") throw e;
    console.warn("⚠️ fs.cpSync не сработал (" + e.code + ") — пробуем robocopy…");
    const { spawnSync } = require("child_process");
    // robocopy: коды 0..7 — успех
    const r = spawnSync("robocopy", [src, dest, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP"], { stdio: "ignore" });
    if (r.status === null || r.status > 7) throw new Error("robocopy завершился с кодом " + r.status);
  }
}
copyDir()
  .then(() => console.log("✅ dist скопирован в electron/dist"))
  .catch((e) => {
    console.error("❌ Не удалось скопировать dist в electron/dist.");
    console.error("   Ошибка: " + e.message);
    console.error("");
    console.error("   Что делать, по порядку:");
    console.error("   1. Закройте Проводник и редакторы — особенно если открыта папка electron\\dist");
    console.error("      (команда в cmd:  taskkill /f /im explorer.exe && start explorer.exe)");
    console.error("   2. Временно отключите антивирус или добавьте папку проекта в исключения");
    console.error("   3. Удалите папку вручную:  cd electron  →  rmdir /s /q dist");
    console.error("   4. Если не помогло — перенесите проект в путь без кириллицы (C:\\Volna) и повторите");
    process.exit(1);
  });
