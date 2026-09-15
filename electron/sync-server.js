/**
 * HTTP-сервер синхронизации Волны (только настольная версия).
 * Отдаёт и принимает снапшоты библиотеки в локальной сети.
 * Протокол: volna-sync/1 — GET/POST /volna/info|snapshot (+ CORS для WebView).
 * Дополнительно раз в 3 секунды шлёт UDP-анонсы (multicast + broadcast),
 * чтобы телефон находил ПК без слепого скана подсети (как в LocalSend).
 */
const http = require("http");
const os = require("os");
const fs = require("fs");
const path = require("path");
const dgram = require("dgram");

const PORT = 51789;
const APP_VERSION = "1.1.0";
const MULTICAST_ADDR = "224.0.0.167";
const ANNOUNCE_EVERY_MS = 3000;
const TOKEN_HEADER = "x-volna-token";
/** Origin'ы WebView (Capacitor), которым разрешён CORS к серверу синхронизации */
const ALLOWED_ORIGINS = new Set(["https://localhost", "capacitor://localhost", "http://localhost"]);

let state = {
  deviceId: "",
  deviceName: "",
  appVersion: "",
  snapshot: null,
  storeFile: null,
  onIncoming: null,
  server: null,
  localIp: null,
  token: "",
};

/** Парный код устройства: постоянный, генерируется один раз, хранится в dataDir.
 *  Без него GET/POST snapshot отклоняются — любой хост в LAN не может
 *  читать или отравлять библиотеку. /volna/info (поиск устройств) остаётся открытым. */
function loadOrCreateToken(dataDir) {
  const file = path.join(dataDir, "sync-token");
  try {
    const t = fs.readFileSync(file, "utf8").trim();
    if (/^[a-f0-9]{12}$/.test(t)) return t;
  } catch {
    /* нет файла — создаём */
  }
  try {
    const t = require("crypto").randomBytes(6).toString("hex");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, t, "utf8");
    return t;
  } catch {
    return "";
  }
}

function localIp() {
  const ifs = os.networkInterfaces();
  for (const list of Object.values(ifs)) {
    for (const i of list || []) {
      if (i.family === "IPv4" && !i.internal) {
        // приоритет: частные сети 192.168/10./172.16-31
        if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address)) return i.address;
      }
    }
  }
  for (const list of Object.values(ifs)) {
    for (const i of list || []) {
      if (i.family === "IPv4" && !i.internal) return i.address;
    }
  }
  return null;
}

function cors(req, res) {
  // CORS только для WebView-приложений (Capacitor), а не "*" для всей сети
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, " + TOKEN_HEADER);
    res.setHeader("Vary", "Origin");
  }
}

function readBody(req, limit = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("too large"));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function infoPayload() {
  return {
    app: "volna",
    proto: 1,
    deviceId: state.deviceId,
    deviceName: state.deviceName,
    deviceType: "pc",
    appVersion: state.appVersion || APP_VERSION,
    rev: state.snapshot ? state.snapshot.rev : "",
  };
}

function authorized(req) {
  return !!state.token && req.headers[TOKEN_HEADER] === state.token;
}

async function handle(req, res) {
  const url = (req.url || "").split("?")[0];
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  if (req.method === "GET" && url === "/volna/info") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(infoPayload()));
    return;
  }
  // Данные библиотеки — только устройствам с парным кодом (см. loadOrCreateToken)
  if (req.method === "GET" && url === "/volna/snapshot") {
    if (!authorized(req)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(state.snapshot || { proto: 1, rev: "", tracks: [], playlists: [], stats: {} }));
    return;
  }
  if (req.method === "POST" && url === "/volna/snapshot") {
    if (!authorized(req)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
      return;
    }
    try {
      const body = await readBody(req);
      const snap = JSON.parse(body);
      if (!snap || !Array.isArray(snap.tracks)) throw new Error("bad snapshot");
      snap.sentAt = Date.now();
      if (state.onIncoming) state.onIncoming(snap);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(400).end(JSON.stringify({ ok: false }));
    }
    return;
  }
  res.writeHead(404).end();
}

function persistOwn() {
  try {
    if (state.snapshot) fs.writeFileSync(state.storeFile, JSON.stringify(state.snapshot), "utf8");
  } catch {
    /* не критично */
  }
}

/** Снапшот от рендерера: сохраняем в состояние и на диск (отдаётся по GET) */
function publishOwn(snap) {
  if (!snap || !Array.isArray(snap.tracks)) return;
  if (typeof snap.sentAt !== "number") snap.sentAt = Date.now();
  state.snapshot = snap;
  persistOwn();
}

/* ---------- UDP-анонсы: телефон слушает их на порту 51789 ---------- */

let announceTimer = null;
let announceSocket = null;

function announceTargets() {
  const targets = new Set([MULTICAST_ADDR, "255.255.255.255"]);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family !== "IPv4" || i.internal) continue;
      const m = i.address.match(/^(\d+\.\d+\.\d+)\.\d+$/);
      if (m) targets.add(`${m[1]}.255`);
    }
  }
  return [...targets];
}

function sendAnnounce(listenPort) {
  const sock = announceSocket;
  if (!sock) return;
  const msg = Buffer.from(
    JSON.stringify({
      app: "volna",
      deviceId: state.deviceId,
      deviceName: state.deviceName,
      deviceType: "pc",
      port: listenPort,
      appVersion: state.appVersion || APP_VERSION,
    }),
    "utf8"
  );
  for (const t of announceTargets()) {
    try {
      sock.send(msg, PORT, t);
    } catch {
      /* интерфейс мог исчезнуть — не критично */
    }
  }
}

function startAnnounce(listenPort) {
  if (announceTimer) return;
  try {
    announceSocket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    announceSocket.on("error", () => {
      /* слушающую сторону тут не ждут — ошибки игнорируем */
    });
    announceSocket.bind(() => {
      try {
        announceSocket.setBroadcast(true);
        try {
          announceSocket.setMulticastTTL(4);
        } catch {
          /* не критично */
        }
      } catch {
        /* не критично */
      }
    });
  } catch {
    announceSocket = null;
  }
  sendAnnounce(listenPort);
  announceTimer = setInterval(() => sendAnnounce(listenPort), ANNOUNCE_EVERY_MS);
}

function stopAnnounce() {
  if (announceTimer) {
    clearInterval(announceTimer);
    announceTimer = null;
  }
  if (announceSocket) {
    try {
      announceSocket.close();
    } catch {
      /* уже закрыт */
    }
    announceSocket = null;
  }
}

/** Запуск сервера. Возвращает статус; не бросает исключений. */
function startSyncServer({ deviceId, deviceName, dataDir, onIncoming, port, appVersion }) {
  const listenPort = Number(port) || PORT;
  state.deviceId = deviceId;
  state.deviceName = deviceName;
  state.appVersion = appVersion || "";
  state.onIncoming = onIncoming;
  state.storeFile = path.join(dataDir, "sync-snapshot.json");
  state.localIp = localIp();
  state.token = loadOrCreateToken(dataDir);
  try {
    if (fs.existsSync(state.storeFile)) {
      state.snapshot = JSON.parse(fs.readFileSync(state.storeFile, "utf8"));
    }
  } catch {
    state.snapshot = null;
  }
  try {
    const server = http.createServer((req, res) => {
      handle(req, res).catch(() => {
        try {
          res.writeHead(500).end();
        } catch {
          /* ignore */
        }
      });
    });
    server.on("error", () => {
      state.server = null;
      stopAnnounce();
    });
    server.listen(listenPort, "0.0.0.0", () => {
      state.server = server;
      startAnnounce(listenPort);
    });
  } catch {
    state.server = null;
  }
  return status();
}

function status() {
  return {
    running: !!state.server,
    port: state.server ? state.server.address()?.port ?? null : null,
    localIp: state.localIp,
    deviceName: state.deviceName,
    token: state.token,
  };
}

/** Полностью остановить сервер и UDP-анонсы (вызывается, когда синхронизация выключена). */
function stopSyncServer() {
  stopAnnounce();
  const s = state.server;
  state.server = null;
  if (s) {
    try {
      s.close();
    } catch {
      /* уже закрыт */
    }
  }
}

module.exports = { startSyncServer, stopSyncServer, status, publishOwn };
