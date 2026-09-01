const { app, BrowserWindow, shell, dialog, ipcMain, protocol, net, screen, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const crypto = require("crypto");
const { Readable } = require("stream");
const { spawn } = require("child_process");
const { startMcpServer } = require("./mcp-server");

const AUDIO_RE = /\.(mp3|flac|wav|ogg|oga|m4a|aac|opus|webm|wma)$/i;
const MIME = {
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".opus": "audio/ogg",
  ".webm": "audio/webm",
  ".wma": "audio/x-ms-wma",
};

/* Корневые папки, разрешённые для volna://local/ */
const roots = new Set();
const coverMap = new Map();
const COVER_MAX = 150;

const DOWNLOADS = () => path.join(app.getPath("userData"), "downloads");
const YTDLP = () => path.join(app.getPath("userData"), "yt-dlp.exe");
const FFMPEG = () => path.join(app.getPath("userData"), "ffmpeg.exe");

function safeSend(win, channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

/* Пиннутые версии + sha256. Обновление — сменой записи в манифесте, не «latest»-ссылкой. */
const RUNTIMES = {
  ytdlp: {
    version: "2026.08.19",
    url: "https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp.exe",
    sha256: "66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a",
  },
  node: {
    version: "v22.23.2",
    url: "https://nodejs.org/dist/v22.23.2/win-x64/node.exe",
    sha256: "0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4",
  },
  ffmpeg: {
    version: "b6.1.1",
    url: "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-win32-x64",
    sha256: "04e1307997530f9cf2fe35cba2ca7e8875ca91da02f89d6c7243df819c94ad00",
  },
};

/* ---------- JS-рантайм для YouTube (новый yt-dlp требует node/deno) ---------- */
// YouTube перестал отдавать данные без JS-рантайма (HTTP 403).
// Качаем портативный node.exe (один файл) и передаём его yt-dlp через --js-runtimes.
async function ensureJsRuntime(win) {
  const nodePath = path.join(app.getPath("userData"), "node.exe");
  try {
    if (fs.existsSync(nodePath)) {
      // проверяем, что node реально запускается
      const ok = await new Promise((res) => {
        const p = spawn(nodePath, ["--version"], { windowsHide: true });
        p.on("error", () => res(false));
        p.on("close", (c) => res(c === 0));
      });
      if (ok) return nodePath;
      try {
        fs.unlinkSync(nodePath);
      } catch {
        /* занят */
      }
    }
    safeSend(win, "dl-progress", { percent: 0.25, status: "Скачиваю JS-рантайм (Node)…" });
    await downloadWithRetry(
      RUNTIMES.node.url,
      nodePath,
      win,
      (pr) => safeSend(win, "dl-progress", { percent: 0.25 + pr * 0.15, status: "Скачиваю JS-рантайм (Node)…" }),
      RUNTIMES.node.sha256
    );
    return fs.existsSync(nodePath) && fs.statSync(nodePath).size > 1_000_000 ? nodePath : null;
  } catch {
    return null;
  }
}

/* Найти рабочий ffmpeg: сначала распакованный из npm (app.asar.unpacked),
   потом скачанный в userData; если нет — скачать с GitHub */
async function ensureFfmpeg(win) {
  try {
    const p = require("ffmpeg-static");
    if (p) {
      const real = p.split("app.asar" + path.sep).join("app.asar.unpacked" + path.sep);
      if (fs.existsSync(real)) return real;
      if (fs.existsSync(p)) return p;
    }
  } catch {
    /* нет пакета */
  }
  if (fs.existsSync(FFMPEG())) return FFMPEG();
  safeSend(win, "dl-progress", { percent: 0.4, status: "Скачиваю FFmpeg…" });
  await downloadWithRetry(
    RUNTIMES.ffmpeg.url,
    FFMPEG(),
    win,
    (pr) => safeSend(win, "dl-progress", { percent: 0.4 + pr * 0.1, status: "Скачиваю FFmpeg…" }),
    RUNTIMES.ffmpeg.sha256
  );
  return FFMPEG();
}

/* ---------- Discord Rich Presence (open source: discord-rpc) ---------- */
// Чтобы статус показывался в Discord, нужно своё приложение:
// discord.com/developers/applications → New Application → скопировать Application ID сюда.
// Без валидного ID RPC просто молча не подключится (ошибки не будет).
const DISCORD_APP_ID = process.env.VOLNA_DISCORD_APP_ID || "1482550819826962503";
// Имя картинки-ассета из Discord Developer Portal (Rich Presence → Art Assets).
// Загрузите туда volna-icon.png (1024×1024) и впишите сюда её имя (например "wave"),
// тогда рядом с названием трека будет отображаться эта иконка.
const DISCORD_ASSET = process.env.VOLNA_DISCORD_ASSET || "volna-icon";
let rpc = null;
let rpcEnabled = true;
let lastActivity = null;

function rpcInit() {
  if (!rpcEnabled || rpc || !DISCORD_APP_ID) return;
  try {
    const RPC = require("discord-rpc");
    rpc = new RPC.Client({ transport: "ipc" });
    rpc.on("ready", () => {
      if (lastActivity) setActivity(lastActivity);
    });
    rpc.on("disconnected", () => {
      rpc = null;
      setTimeout(rpcInit, 30000);
    });
    rpc.login({ clientId: DISCORD_APP_ID }).catch(() => {
      rpc = null;
    });
  } catch {
    rpc = null;
  }
}

function setActivity(a) {
  if (!rpc || !rpc.user) return;
  try {
    rpc.setActivity({
      type: 2, // Listening
      details: a.title || "Без трека",
      state: a.artist || undefined,
      instance: false,
      // «осталось X:XX» — обратный отсчёт как у Spotify (передаём endTimestamp)
      endTimestamp: a.end || undefined,
      // иконка из Art Assets портала разработчика (если задана)
      largeImageKey: DISCORD_ASSET || undefined,
      largeImageText: a.artist || "Волна",
    });
  } catch {
    /* не критично */
  }
}

function rpcDestroy() {
  if (rpc) {
    try {
      rpc.destroy();
    } catch {
      /* */
    }
    rpc = null;
  }
}

/* ---------- utils ---------- */
function rootsFile() {
  return path.join(app.getPath("userData"), "volna-roots.json");
}
function loadRoots() {
  try {
    const arr = JSON.parse(fs.readFileSync(rootsFile(), "utf8"));
    if (Array.isArray(arr)) arr.forEach((p) => typeof p === "string" && roots.add(p));
  } catch {
    /* первый запуск */
  }
}
function persistRoots() {
  try {
    fs.writeFileSync(rootsFile(), JSON.stringify([...roots]));
  } catch {
    /* некритично */
  }
}

function simpleHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function isAllowed(p) {
  const resolved = path.resolve(p).toLowerCase();
  return [...roots].some((r) => {
    const rr = path.resolve(r).toLowerCase();
    return resolved === rr || resolved.startsWith(rr + path.sep);
  });
}

async function walk(dir, base, depth = 0) {
  const out = [];
  let truncated = false;
  if (depth > 12) return { files: out, truncated };
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return { files: out, truncated };
  }
  for (const ent of entries) {
    if (out.length >= 5000) {
      truncated = true;
      break;
    }
    if (ent.name.startsWith(".")) continue;
    if (ent.name === "node_modules" || ent.name === "$RECYCLE.BIN" || ent.name === "System Volume Information") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      const sub = await walk(full, base, depth + 1);
      out.push(...sub.files);
      if (sub.truncated) truncated = true;
    } else if (AUDIO_RE.test(ent.name)) {
      try {
        const st = await fsp.stat(full);
        out.push({ rel: path.relative(base, full).split(path.sep).join("/"), size: st.size, mtimeMs: st.mtimeMs });
      } catch {
        /* пропускаем */
      }
    }
  }
  return { files: out, truncated };
}

function coverExt(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("png")) return ".png";
  if (t.includes("webp")) return ".webp";
  if (t.includes("gif")) return ".gif";
  return ".jpg";
}

async function getTagsFor(filePath) {
  let mm = null;
  try {
    mm = require("music-metadata");
  } catch {
    return null;
  }
  try {
    const meta = await mm.parseFile(filePath, { duration: true, skipCovers: false });
    const pic = (meta.common.picture || [])[0];
    let coverHash = null;
    if (pic && pic.data && pic.data.length) {
      const buf = pic.data.length > 3_000_000 ? pic.data.subarray(0, 3_000_000) : pic.data;
      const type = pic.format || "image/jpeg";
      coverHash = simpleHash(filePath);
      coverMap.set(coverHash, { data: buf, type });
      if (coverMap.size > COVER_MAX) {
        const firstKey = coverMap.keys().next().value;
        if (firstKey !== undefined) coverMap.delete(firstKey);
      }
      const dir = path.join(app.getPath("userData"), "covers");
      fsp
        .mkdir(dir, { recursive: true })
        .then(() => fsp.writeFile(path.join(dir, coverHash + coverExt(type)), buf))
        .catch(() => {});
    }
    return {
      title: meta.common.title || null,
      artist: meta.common.artist || (meta.common.artists || [])[0] || null,
      album: meta.common.album || null,
      duration: Number.isFinite(meta.format.duration) ? meta.format.duration : 0,
      coverHash,
    };
  } catch {
    return null;
  }
}

/* ---------- скачивание файлов (для yt-dlp/node/ffmpeg) ----------
   Пишет в dest + ".part", проверяет sha256, переименовывает по успеху.
   Таймаут неактивности 30 c, ретраи — в downloadWithRetry. */
function downloadFile(url, dest, win, onProgress, expectedSha) {
  return new Promise((resolve, reject) => {
    const tmp = dest + ".part";
    let settled = false;
    let idle = null;
    const finish = (fn, val) => {
      if (settled) return;
      settled = true;
      if (idle) clearTimeout(idle);
      fn(val);
    };
    const armIdle = () => {
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => {
        try {
          req.destroy(new Error("download idle timeout"));
        } catch {}
      }, 30000);
    };
    const req = net.request(url);
    req.on("response", (res) => {
      if (res.statusCode >= 400) {
        res.resume();
        finish(reject, new Error("HTTP " + res.statusCode));
        return;
      }
      const total = Number(res.headers["content-length"] || 0);
      let got = 0;
      const hasher = expectedSha ? crypto.createHash("sha256") : null;
      const out = fs.createWriteStream(tmp);
      armIdle();
      res.on("data", (c) => {
        got += c.length;
        if (hasher) hasher.update(c);
        if (total && onProgress) onProgress(got / total);
        armIdle();
      });
      res.on("error", (e) => {
        try { out.destroy(); } catch {}
        try { fs.unlinkSync(tmp); } catch {}
        finish(reject, e);
      });
      res.pipe(out);
      out.on("finish", () => {
        if (expectedSha && hasher.digest("hex") !== expectedSha) {
          try { fs.unlinkSync(tmp); } catch {}
          finish(reject, new Error("sha256 mismatch: " + url));
          return;
        }
        try {
          fs.renameSync(tmp, dest);
          finish(resolve);
        } catch (e) {
          try { fs.unlinkSync(tmp); } catch {}
          finish(reject, e);
        }
      });
      out.on("error", (e) => {
        try { fs.unlinkSync(tmp); } catch {}
        finish(reject, e);
      });
    });
    req.on("error", (e) => {
      try { fs.unlinkSync(tmp); } catch {}
      finish(reject, e);
    });
    armIdle();
    req.end();
  });
}

async function downloadWithRetry(url, dest, win, onProgress, expectedSha, attempts = 3) {
  let lastErr = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      await downloadFile(url, dest, win, onProgress, expectedSha);
      return;
    } catch (e) {
      lastErr = e;
      if (i < attempts) await new Promise((r) => setTimeout(r, i * 2000));
    }
  }
  throw lastErr;
}

let lastYtDlpUpdate = 0;

async function ensureYtDlp(win) {
  if (!fs.existsSync(YTDLP())) {
    safeSend(win, "dl-progress", { percent: 0, status: "Скачиваю yt-dlp…" });
    await downloadWithRetry(
      RUNTIMES.ytdlp.url,
      YTDLP(),
      win,
      (p) => safeSend(win, "dl-progress", { percent: p * 0.25, status: "Скачиваю yt-dlp…" }),
      RUNTIMES.ytdlp.sha256
    );
  }
  if (Date.now() - lastYtDlpUpdate > 24 * 60 * 60 * 1000) {
    lastYtDlpUpdate = Date.now();
    try {
      const upd = spawn(YTDLP(), ["-U"], { windowsHide: true });
      await new Promise((r) => {
        upd.on("close", r);
        upd.on("error", r);
        setTimeout(r, 30000);
      });
    } catch {
      /* не критично */
    }
  }
  // Проверяем, что бинарник живой; если нет — качаем пиннутую версию с проверкой хэша
  try {
    const ok = await new Promise((res) => {
      const v = spawn(YTDLP(), ["--version"], { windowsHide: true });
      let out = "";
      v.stdout.on("data", (d) => (out += d.toString()));
      v.on("error", () => res(false));
      v.on("close", (c) => res(c === 0 && out.trim().length > 0));
    });
    if (!ok) {
      safeSend(win, "dl-progress", { percent: 0, status: "Обновляю yt-dlp…" });
      await downloadWithRetry(RUNTIMES.ytdlp.url, YTDLP(), win, () => {}, RUNTIMES.ytdlp.sha256);
    }
  } catch {
    /* не критично */
  }
}

/* Запуск yt-dlp для коротких задач (поиск, метаданные) с таймаутом */
function runYtDlp(args, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP(), args, { windowsHide: true });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      try {
        proc.kill();
      } catch {
        /* уже мёртв */
      }
      reject(new Error("yt-dlp timeout"));
    }, timeoutMs);
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error((err || "yt-dlp failed").slice(-600)));
    });
  });
}

/** Достать лучшую обложку из массива thumbnails yt-dlp */
function pickThumb(entry) {
  if (!entry) return null;
  if (typeof entry.thumbnail === "string" && entry.thumbnail) return entry.thumbnail;
  const arr = Array.isArray(entry.thumbnails) ? entry.thumbnails : [];
  if (arr.length) {
    const best = [...arr].sort((a, b) => (b.width || b.height || 0) - (a.width || a.height || 0))[0];
    if (best && best.url) return best.url;
  }
  // YouTube-заглушка по id видео
  if (typeof entry.id === "string" && /^[A-Za-z0-9_-]{6,20}$/.test(entry.id)) {
    return "https://i.ytimg.com/vi/" + entry.id + "/mqdefault.jpg";
  }
  return null;
}

let dlProc = null; // активный процесс скачивания (для кнопки «Отмена»)

/* ---- поиск музыки на YouTube по названию (yt-dlp ytsearch, без скачивания) ---- */
async function ytSearch(query) {
  if (typeof query !== "string" || !query.trim()) return [];
  await ensureYtDlp(getMainWindow());
  const json = await runYtDlp([
    "--flat-playlist",
    "--dump-single-json",
    "--no-playlist",
    "ytsearch10:" + query.trim(),
  ]);
  const data = JSON.parse(json);
  const entries = Array.isArray(data) ? data.flatMap((d) => d.entries || []) : data.entries || [];
  return entries
    .filter(Boolean)
    .map((en) => ({
      url: en.url || en.webpage_url || (en.id ? "https://www.youtube.com/watch?v=" + en.id : null),
      title: typeof en.title === "string" ? en.title : "",
      channel: en.uploader || en.channel || "",
      duration: Number.isFinite(en.duration) ? en.duration : 0,
      thumb: pickThumb(en),
    }))
    .filter((v) => v.url && v.title)
    .slice(0, 10);
}

/* ---------- протокол volna:// ---------- */
protocol.registerSchemesAsPrivileged([
  { scheme: "volna", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

function registerProtocol() {
  protocol.handle("volna", async (request) => {
    const u = new URL(request.url);

    if (u.host === "cover") {
      const hash = decodeURIComponent(u.pathname.slice(1));
      if (!/^[0-9a-f]{1,16}$/i.test(hash)) return new Response(null, { status: 400 });
      const pic = coverMap.get(hash);
      if (pic) {
        return new Response(pic.data, {
          status: 200,
          headers: { "Content-Type": pic.type, "Cache-Control": "public, max-age=86400" },
        });
      }
      const dir = path.join(app.getPath("userData"), "covers");
      for (const ext of [".jpg", ".png", ".webp", ".gif"]) {
        const p = path.join(dir, hash + ext);
        if (fs.existsSync(p)) {
          try {
            const data = await fsp.readFile(p);
            const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
            return new Response(data, {
              status: 200,
              headers: { "Content-Type": mime, "Cache-Control": "public, max-age=86400" },
            });
          } catch {
            /* дальше */
          }
        }
      }
      return new Response(null, { status: 404 });
    }

    if (u.host === "local") {
      const filePath = decodeURIComponent(u.pathname.slice(1));
      if (!isAllowed(filePath)) return new Response(null, { status: 403 });
      let size;
      try {
        size = (await fsp.stat(filePath)).size;
      } catch {
        return new Response(null, { status: 404 });
      }
      const ext = path.extname(filePath).toLowerCase();
      const ct = MIME[ext] || "application/octet-stream";
      const range = request.headers.get("Range");
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (m) {
          let start = m[1] ? parseInt(m[1], 10) : 0;
          let end = m[2] ? parseInt(m[2], 10) : size - 1;
          if (start > end || start >= size) {
            return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
          }
          end = Math.min(end, size - 1);
          const stream = Readable.toWeb(fs.createReadStream(filePath, { start, end }));
          return new Response(stream, {
            status: 206,
            headers: {
              "Content-Type": ct,
              "Content-Length": String(end - start + 1),
              "Content-Range": `bytes ${start}-${end}/${size}`,
              "Accept-Ranges": "bytes",
              "Cache-Control": "no-store",
            },
          });
        }
      }
      return new Response(Readable.toWeb(fs.createReadStream(filePath)), {
        status: 200,
        headers: {
          "Content-Type": ct,
          "Content-Length": String(size),
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store",
        },
      });
    }

    return new Response(null, { status: 404 });
  });
}

/* ---------- мини-плеер ---------- */
let miniWin = null;

function getMainWindow() {
  return BrowserWindow.getAllWindows().find((w) => w !== miniWin) || BrowserWindow.getAllWindows()[0];
}

function sendMiniVisibility(visible) {
  const m = getMainWindow();
  if (m && !m.isDestroyed()) m.webContents.send("mini-visible", visible);
}

function createMini() {
  if (miniWin && !miniWin.isDestroyed()) {
    miniWin.show();
    return miniWin;
  }
  miniWin = new BrowserWindow({
    width: 420,
    height: 176,
    minWidth: 300,
    minHeight: 64,
    frame: false,
    resizable: true, // размер мини-плеера можно менять мышью за края
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    transparent: true, // прозрачность для режима «без фона»
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  const wa = screen.getPrimaryDisplay().workArea;
  // восстанавливаем сохранённые позицию и размер оверлея
  try {
    const boundsFile = path.join(app.getPath("userData"), "mini-bounds.json");
    const b = JSON.parse(fs.readFileSync(boundsFile, "utf8"));
    if (b && typeof b.width === "number" && typeof b.x === "number") {
      // окно обязано остаться в пределах экрана
      const x = Math.min(Math.max(b.x, wa.x), wa.x + wa.width - 120);
      const y = Math.min(Math.max(b.y, wa.y), wa.y + wa.height - 60);
      miniWin.setBounds({ x, y, width: b.width, height: b.height });
    }
  } catch {
    miniWin.setPosition(wa.x + wa.width - 420, wa.y + wa.height - 170);
  }
  const saveBounds = () => {
    try {
      fs.writeFileSync(
        path.join(app.getPath("userData"), "mini-bounds.json"),
        JSON.stringify(miniWin.getBounds())
      );
    } catch {
      /* не критично */
    }
  };
  /* Прозрачные окна на Windows могут терять поверх всех окон —
     держим максимальный уровень topmost и переподтверждаем на событиях */
  const keepOnTop = () => {
    if (miniWin && !miniWin.isDestroyed()) {
      try {
        miniWin.setAlwaysOnTop(true, "screen-saver");
      } catch {
        /* не критично */
      }
    }
  };
  miniWin.setAlwaysOnTop(true, "screen-saver");
  miniWin.on("moved", () => {
    saveBounds();
    keepOnTop();
  });
  miniWin.on("resized", () => {
    saveBounds();
    keepOnTop();
  });
  miniWin.on("show", keepOnTop);
  miniWin.on("restore", keepOnTop);
  miniWin.on("blur", keepOnTop);

  const distIndex = path.join(__dirname, "dist", "index.html");
  if (process.env.VITE_DEV_SERVER_URL) {
    miniWin.loadURL(process.env.VITE_DEV_SERVER_URL + "/?mini=1").catch(() => {
      miniWin.loadFile(distIndex, { query: { mini: "1" } });
    });
  } else {
    miniWin.loadFile(distIndex, { query: { mini: "1" } }).catch(() => {
      miniWin.loadURL("http://localhost:5173/?mini=1");
    });
  }
  miniWin.once("ready-to-show", () => {
    miniWin.show();
    keepOnTop();
  });
  miniWin.on("closed", () => {
    miniWin = null;
    sendMiniVisibility(false);
    const m = getMainWindow();
    if (m && !m.isDestroyed() && !m.isVisible()) m.show();
  });
  sendMiniVisibility(true);
  return miniWin;
}

/* ---------- IPC ---------- */
function registerIpc() {
  ipcMain.handle("pick-folder", async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const r = await dialog.showOpenDialog(win, { properties: ["openDirectory"], title: "Выберите папку с музыкой" });
    if (r.canceled || !r.filePaths[0]) return null;
    const p = r.filePaths[0];
    roots.add(p);
    persistRoots();
    const scanned = await walk(p, p);
    return { path: p, name: path.basename(p), files: scanned.files, truncated: scanned.truncated };
  });

  ipcMain.handle("scan-folder", async (_e, p) => {
    if (typeof p !== "string") return null;
    const rp = path.resolve(p).toLowerCase();
    if (![...roots].some((r) => path.resolve(r).toLowerCase() === rp)) return null;
    const scanned = await walk(p, p);
    return { path: p, name: path.basename(p), files: scanned.files, truncated: scanned.truncated };
  });

  ipcMain.handle("get-tags", async (_e, paths) => {
    const out = {};
    if (!Array.isArray(paths)) return out;
    for (const p of paths.slice(0, 3000)) {
      if (typeof p !== "string" || !isAllowed(p)) continue;
      const tags = await getTagsFor(p);
      if (tags) out[p] = tags;
    }
    return out;
  });

  ipcMain.handle("open-folder", async (_e, p) => {
    if (typeof p !== "string") return;
    try {
      // папка — открываем её саму; файл — открываем папку и выделяем файл
      const st = await fsp.stat(p);
      if (st.isDirectory()) await shell.openPath(p);
      else shell.showItemInFolder(p);
    } catch {
      shell.openPath(path.dirname(p));
    }
  });

  /* ---- удаление файла с диска (только из разрешённых корней) ---- */
  ipcMain.handle("delete-file", async (_e, p) => {
    try {
      if (typeof p !== "string" || !isAllowed(p)) return { ok: false, error: "Path is not allowed" };
      await fsp.unlink(p);
      // подчищаем пустые sidecar-файлы обложек не требуется — обложки в userData
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  /* ---- мини-плеер ---- */
  ipcMain.handle("mini-open", () => {
    createMini();
    const m = getMainWindow();
    if (m && !m.isDestroyed()) m.hide();
  });

  ipcMain.on("mini-command", (_e, cmd) => {
    if (cmd === "open-full") {
      if (miniWin && !miniWin.isDestroyed()) miniWin.close();
      sendMiniVisibility(false);
      const m = getMainWindow();
      if (m && !m.isDestroyed()) {
        m.show();
        m.focus();
      }
      return;
    }
    const m = getMainWindow();
    if (m && !m.isDestroyed()) m.webContents.send("renderer-command", cmd);
  });

  ipcMain.on("mini-state", (_e, state) => {
    if (miniWin && !miniWin.isDestroyed()) miniWin.webContents.send("mini-state", state);
  });

  /* ---- оверлей: ресайз из пресетов вида ---- */
  ipcMain.on("mini-resize", (e, w, h) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && win === miniWin && !miniWin.isDestroyed()) {
      const width = Math.max(280, Math.round(Number(w) || 0));
      const height = Math.max(60, Math.round(Number(h) || 0));
      const b = miniWin.getBounds();
      miniWin.setBounds({ x: b.x, y: b.y, width, height });
      try {
        miniWin.setAlwaysOnTop(true, "screen-saver");
      } catch {
        /* не критично */
      }
    }
  });

  /* ---- кастомный titlebar ---- */
  ipcMain.on("window-control", (_e, action) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!win || win === miniWin) return;
    if (action === "minimize") win.minimize();
    else if (action === "maximize") {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    } else if (action === "close") win.close();
  });

  ipcMain.handle("window-is-maximized", (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    return win ? win.isMaximized() : false;
  });

  /* ---- Discord RPC ---- */
  ipcMain.on("rpc-update", (_e, data) => {
    lastActivity = data;
    setActivity(data);
  });
  ipcMain.on("rpc-enabled", (_e, on) => {
    rpcEnabled = !!on;
    if (!rpcEnabled) rpcDestroy();
    else rpcInit();
  });

  /* ---- скачивание аудио по ссылке (yt-dlp) ---- */
  ipcMain.handle("dl-download", async (e, url, destDir) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win || typeof url !== "string" || !/^https?:\/\//.test(url)) {
      safeSend(win, "dl-error", { message: "Некорректная ссылка" });
      return { ok: false };
    }
    if (dlProc) {
      safeSend(win, "dl-error", { message: "Уже идёт другое скачивание" });
      return { ok: false };
    }
    try {
      await ensureYtDlp(win);
      // Куда скачивать: предпочтительно папка пользователя с музыкой (чтобы трек
      // сразу попадал в библиотеку и синхронизацию), иначе — папка загрузок в userData.
      // destDir из рендерера принимаем только если он внутри разрешённых корней.
      let target = DOWNLOADS();
      if (typeof destDir === "string" && destDir.trim()) {
        const p = path.resolve(destDir);
        const pl = p.toLowerCase();
        const allowed = [...roots, app.getPath("music"), app.getPath("downloads")].some((r) => {
          try {
            const rr = path.resolve(r).toLowerCase();
            return pl === rr || pl.startsWith(rr + path.sep);
          } catch {
            return false;
          }
        });
        if (allowed) {
          try {
            fs.mkdirSync(p, { recursive: true });
            fs.accessSync(p, fs.constants.W_OK);
            target = p;
          } catch {
            target = DOWNLOADS();
          }
        }
      }
      fs.mkdirSync(target, { recursive: true });
      roots.add(target);
      persistRoots();

      const args = [
        "-x",
        "--audio-format",
        "mp3",
        "--embed-thumbnail",
        "--embed-metadata",
        "--parse-metadata",
        "uploader:artist",
        "--no-playlist",
        "--newline",
        "--retries",
        "3",
        "--retry-sleep",
        "2",
        "-o",
        "%(title)s.%(ext)s",
        url,
      ];
      // Обход бот-детекта YouTube (HTTP 403): мобильный/Safari клиент
      // блокируется гораздо реже, чем обычный веб-клиент
      args.unshift("--extractor-args", "youtube:player_client=android,web_safari");
      // JS-рантайм (node) обязателен для YouTube — ищем/качаем заранее
      const rt = await ensureJsRuntime(win);
      if (rt) args.unshift("--js-runtimes", "node:" + rt);
      // FFmpeg обязателен для конвертации в mp3 — ищем/качаем заранее
      const ff = await ensureFfmpeg(win);
      if (ff) args.unshift("--ffmpeg-location", path.dirname(ff));

      const proc = spawn(YTDLP(), args, { cwd: target, windowsHide: true });
      dlProc = proc;
      let buf = "";
      let errTail = "";
      proc.stderr.on("data", (d) => {
        const s = d.toString();
        buf += s;
        errTail = (errTail + s).slice(-1200);
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        const last = lines.filter(Boolean).pop() || buf;
        const m = /\[download\]\s+([\d.]+)%/.exec(last);
        if (m) {
          const pct = Number(m[1]) / 100;
          const status = pct >= 1 ? "Обработка аудио…" : "Скачиваю аудио…";
          safeSend(win, "dl-progress", { percent: 0.5 + pct * 0.5, status });
        }
        if (buf.length > 20000) buf = buf.slice(-20000);
      });

      const code = await new Promise((res) => proc.on("close", res));
      dlProc = null;
      if (code !== 0) throw new Error("yt-dlp (код " + code + "): " + (errTail || "неизвестная ошибка"));

      const files = fs
        .readdirSync(target)
        .filter((f) => AUDIO_RE.test(f))
        .map((f) => ({ f, m: fs.statSync(path.join(target, f)).mtimeMs }))
        .sort((a, b) => b.m - a.m);
      const file = files[0];
      if (!file) throw new Error("Файл не был создан");
      const abs = path.join(target, file.f);
      // Читаем теги прямо из скачанного файла: исполнитель, альбом,
      // длительность, обложка — чтобы трек сразу был полным в библиотеке
      let extra = { title: file.f.replace(/\.[^.]+$/, ""), artist: "", album: "", duration: 0, coverHash: null };
      try {
        const tags = await getTagsFor(abs);
        if (tags) {
          let artist = tags.artist || "";
          // автогенерируемые каналы YouTube называются «Имя - Topic» — убираем хвост
          artist = artist.replace(/\s*-\s*Topic\s*$/i, "").trim();
          extra = {
            title: tags.title || extra.title,
            artist,
            album: tags.album || "",
            duration: tags.duration || 0,
            coverHash: tags.coverHash,
          };
        }
      } catch {
        /* теги не критичны */
      }
      safeSend(win, "dl-done", { path: abs, ...extra });
      return { ok: true };
    } catch (err) {
      dlProc = null;
      safeSend(win, "dl-error", { message: String((err && err.message) || err) });
      return { ok: false };
    }
  });

  /* ---- настройки основного окна (прозрачность / размытие фона) ---- */
  ipcMain.handle("get-window-prefs", () => windowPrefs);

  ipcMain.handle("set-window-prefs", (_e, patch) => {
    if (!patch || typeof patch !== "object") return windowPrefs;
    if (typeof patch.transparent === "boolean") windowPrefs.transparent = patch.transparent;
    if (["none", "acrylic", "mica"].includes(patch.material)) {
      windowPrefs.material = patch.material;
      // размытие применяется сразу, без перезапуска
      if (windowPrefs.transparent) {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          try {
            win.setBackgroundMaterial(windowPrefs.material === "none" ? "auto" : windowPrefs.material);
          } catch {
            /* не поддерживается */
          }
        }
      }
    }
    try {
      fs.writeFileSync(windowPrefsFile(), JSON.stringify(windowPrefs));
    } catch {
      /* не критично */
    }
    return windowPrefs;
  });

  /* ---- отмена активного скачивания ---- */
  ipcMain.handle("dl-cancel", () => {
    const p = dlProc;
    if (p) {
      try {
        p.kill();
      } catch {
        /* уже завершён */
      }
      dlProc = null;
    }
  });

  /* ---- состояние плеера для MCP-сервера (рендерер шлёт снапшоты) ---- */
  ipcMain.on("mcp-state", (_e, s) => {
    if (s && typeof s === "object") mcpState = { ...mcpState, ...s };
  });

  /* ---- информация о MCP-сервере для кнопки «Подключить MCP» ---- */
  ipcMain.handle("mcp-info", () => {
    // в установленном приложении мост лежит рядом с app.asar (resources/),
    // в dev-режиме — рядом с main.js
    const bridgePath = app.isPackaged
      ? path.join(path.dirname(process.execPath), "resources", "mcp-bridge.js")
      : path.join(__dirname, "mcp-bridge.js");
    return {
      enabled: process.env.VOLNA_MCP_DISABLED !== "1",
      port: mcpPort,
      bridgePath,
      config: JSON.stringify({ mcpServers: { volna: { command: "node", args: [bridgePath] } } }, null, 2),
    };
  });

  /* ---- поиск музыки на YouTube по названию (используется UI и MCP) ---- */
  ipcMain.handle("dl-search", async (_e, query) => {
    try {
      return await ytSearch(query);
    } catch (err) {
      throw new Error(String((err && err.message) || err));
    }
  });

  /* ---- метаданные по ссылке (название/обложка/канал) — для карточки в очереди скачивания ---- */
  ipcMain.handle("dl-meta", async (_e, url) => {
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) return null;
    try {
      await ensureYtDlp(getMainWindow());
      const json = await runYtDlp(["--no-playlist", "--skip-download", "-J", url], 30000);
      const d = JSON.parse(json);
      return {
        title: typeof d.title === "string" ? d.title : null,
        channel: d.uploader || d.channel || "",
        duration: Number.isFinite(d.duration) ? d.duration : 0,
        thumb: pickThumb(d),
      };
    } catch {
      return null; // метаданные не критичны — скачаем и так
    }
  });
}

/* ---------- настройки окна (прозрачность, размытие фона) ---------- */
function windowPrefsFile() {
  return path.join(app.getPath("userData"), "window-prefs.json");
}
function loadWindowPrefs() {
  try {
    const p = JSON.parse(fs.readFileSync(windowPrefsFile(), "utf8"));
    return {
      transparent: p.transparent === true,
      material: ["none", "acrylic", "mica"].includes(p.material) ? p.material : "none",
    };
  } catch {
    return { transparent: false, material: "none" };
  }
}
let windowPrefs = { transparent: false, material: "none" };

/* ---------- MCP: снапшот состояния плеера + запуск сервера ---------- */
let mcpState = null;
let mcpPort = null; // фактический порт — показываем в настройках («Подключить MCP»)

function startMcp() {
  if (process.env.VOLNA_MCP_DISABLED === "1") return;
  const basePort = Number(process.env.VOLNA_MCP_PORT) || 57624;
  startMcpServer({
    port: basePort,
    getState: () => mcpState,
    // команды MCP идут в рендерер по тому же каналу, что и команды оверлея
    sendCommand: (cmd) => safeSend(getMainWindow(), "renderer-command", cmd),
    youtubeSearch: ytSearch,
    log: (msg) => console.log("[Волна]", msg),
  })
    .then(({ port }) => {
      mcpPort = port;
      // файл-указатель для stdio-моста и других агентов: здесь фактический порт
      try {
        fs.writeFileSync(
          path.join(app.getPath("userData"), "mcp.json"),
          JSON.stringify({ port, pid: process.pid, ts: Date.now() })
        );
      } catch {
        /* не критично */
      }
    })
    .catch((e) => {
      mcpPort = null;
      console.log("[Волна] MCP-сервер не запущен:", String((e && e.message) || e));
    });
}

function createWindow() {
  // Определяем монитор под курсором и подгоняем размер под его рабочую область:
  // при любом системном масштабе Windows (125%/150%) окно всегда влезает
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const wa = display.workArea;
  const width = Math.min(1280, Math.max(940, wa.width - 40));
  const height = Math.min(840, Math.max(600, wa.height - 40));

  const win = new BrowserWindow({
    width,
    height,
    useContentSize: true,
    minWidth: 720,
    minHeight: 540,
    // прозрачный режим: сквозь окно видно рабочий стол (+ размытие за окном)
    backgroundColor: windowPrefs.transparent ? "#00000000" : "#0a0d14",
    transparent: windowPrefs.transparent,
    autoHideMenuBar: true,
    title: "Волна",
    icon: path.join(__dirname, "build", "icon.ico"),
    // Прозрачный верхний titlebar: системные кнопки (свернуть/развернуть/закрыть)
    // рисуются поверх веб-контента, а полоса под ними — полностью прозрачная
    // (сквозь неё видно обои и фон темы). В прозрачном режиме системный оверлей
    // несовместим — кнопки рисует сам интерфейс (windowControls).
    titleBarStyle: "hidden",
    ...(windowPrefs.transparent
      ? {}
      : {
          titleBarOverlay: {
            color: "#00000000",
            symbolColor: "#ffffff",
            height: 40,
          },
        }),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  // Размытие фона за окном (Windows 11): acrylic / mica
  if (windowPrefs.transparent && windowPrefs.material !== "none") {
    try {
      win.setBackgroundMaterial(windowPrefs.material);
    } catch {
      /* не Windows 11 или не поддерживается */
    }
  }

  // Страховка №1: окно обязано целиком влезать в рабочий стол (сдвигаем и ужимаем)
  win.once("ready-to-show", () => {
    const b = win.getBounds();
    const d = screen.getDisplayMatching(b);
    const a = d.workArea;
    if (b.x < a.x || b.y < a.y || b.x + b.width > a.x + a.width || b.y + b.height > a.y + a.height) {
      win.setBounds({
        x: a.x + Math.max(0, Math.round((a.width - b.width) / 2)),
        y: a.y + Math.max(0, Math.round((a.height - b.height) / 2)),
        width: Math.min(b.width, a.width),
        height: Math.min(b.height, a.height),
      });
    }

    // Страховка №2: если контент не влезает — аккуратно уменьшаем нативный масштаб.
    // setZoomFactor масштабирует отрисовку целиком, при этом 100vh/100dvh
    // остаются равными размеру окна: ничего не режется, всё просто мельче.
    const cs = win.getContentSize();
    const zoom = Math.min(1, cs[0] / 1180, cs[1] / 760);
    if (zoom < 0.96) {
      win.webContents.setZoomFactor(Math.max(0.55, Math.round(zoom * 100) / 100));
    }

    // Диагностика: эти цифры помогут, если проблема останется
    console.log(
      "[Волна] экран:", a,
      "| окно:", b,
      "| контент:", cs,
      "| zoom:", win.webContents.getZoomFactor()
    );
  });

  win.on("maximize", () => win.webContents.send("window-state", true));
  win.on("unmaximize", () => win.webContents.send("window-state", false));

  const distIndex = path.join(__dirname, "dist", "index.html");
  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(devUrl).catch(() => win.loadFile(distIndex));
  else win.loadFile(distIndex).catch(() => win.loadURL(devUrl));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e) => e.preventDefault());
}

app.whenReady().then(() => {
  loadRoots();
  windowPrefs = loadWindowPrefs();
  fs.mkdirSync(DOWNLOADS(), { recursive: true });
  roots.add(DOWNLOADS());
  registerProtocol();
  registerIpc();
  startMcp();
  rpcInit();
  createWindow();
  // глобальный хоткей режима перемещения оверлея (как в Discord)
  try {
    globalShortcut.register("Control+Alt+M", () => {
      if (miniWin && !miniWin.isDestroyed()) miniWin.webContents.send("mini-move-mode");
    });
  } catch {
    /* хоткей занят — не критично, есть кнопка в самом оверлее */
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  try {
    globalShortcut.unregisterAll();
  } catch {
    /* не критично */
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
