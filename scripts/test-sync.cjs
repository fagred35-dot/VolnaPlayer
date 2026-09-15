/* Временный smoke-тест HTTP-сервера синхронизации (запускается без Electron) */
const path = require("path");
const fs = require("fs");
const os = require("os");
const dgram = require("dgram");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "volna-sync-test-"));
const server = require("../electron/sync-server.js");

// порт можно переопределить (если 51789 занят, например зомби-процессом)
const PORT = Number(process.env.VOLNA_TEST_PORT) || 51789;
const B = `http://127.0.0.1:${PORT}`;

let failed = false;
const fail = (msg) => {
  failed = true;
  console.error("FAIL:", msg);
};

server.startSyncServer({
  deviceId: "pc_test",
  deviceName: "TestPC",
  dataDir,
  port: PORT,
  onIncoming: (snap) => {
    if (snap && snap.deviceId === "phone_test" && Array.isArray(snap.tracks)) {
      console.log("PASS: incoming snapshot forwarded to renderer callback");
    } else {
      fail("bad incoming snapshot");
    }
  },
});

(async () => {
  await new Promise((r) => setTimeout(r, 400)); // ждём открытия порта
  const st = server.status();
  if (!st.running || st.port !== PORT || !st.localIp) fail("server status: " + JSON.stringify(st));
  else console.log("PASS: server running on", st.port, "ip", st.localIp);

  server.publishOwn({ rev: "rev_a", tracks: [{ key: "a.mp3|123" }], playlists: [], stats: {} });

  const info = await (await fetch(B + "/volna/info")).json();
  if (info.app === "volna" && info.deviceId === "pc_test" && info.deviceType === "pc" && info.rev === "rev_a")
    console.log("PASS: /volna/info");
  else fail("info: " + JSON.stringify(info));

  const snap = await (await fetch(B + "/volna/snapshot")).json();
  if (snap.rev === "rev_a" && snap.tracks.length === 1) console.log("PASS: /volna/snapshot GET");
  else fail("snapshot: " + JSON.stringify(snap));

  const post = await (
    await fetch(B + "/volna/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proto: 1, deviceId: "phone_test", deviceName: "Phone", deviceType: "mobile", rev: "rev_b", tracks: [], playlists: [], stats: {} }),
    })
  ).json();
  if (post.ok) console.log("PASS: /volna/snapshot POST");
  else fail("post: " + JSON.stringify(post));

  const notFound = await fetch(B + "/whatever");
  if (notFound.status === 404) console.log("PASS: 404 on unknown path");
  else fail("404 expected, got " + notFound.status);

  // CORS-заголовки для WebView
  const cors = await fetch(B + "/volna/info");
  if (cors.headers.get("access-control-allow-origin") === "*") console.log("PASS: CORS");
  else fail("CORS missing");

  // UDP-анонсы: сервер должен раз в 3с слать их на broadcast/multicast.
  // Слушаем как настоящий телефон (SyncPlugin): привязка к порту 51789.
  // На CI/виртуалках broadcast может резаться — поэтому мягкая проверка (warn).
  await new Promise((resolve) => {
    const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
    let done = false;
    const stop = (ok) => {
      if (done) return;
      done = true;
      try {
        sock.close();
      } catch {}
      if (ok) console.log("PASS: UDP announce received");
      else console.log("WARN: UDP announce not received in 4s (broadcast может резаться окружением)");
      resolve();
    };
    sock.on("error", () => stop(false));
    sock.on("message", (buf) => {
      try {
        const j = JSON.parse(buf.toString("utf8"));
        if (j.app === "volna" && j.deviceId === "pc_test" && j.deviceType === "pc" && j.port === PORT) stop(true);
      } catch {
        /* чужой пакет — ждём дальше */
      }
    });
    sock.bind(51789, () => {
      try {
        sock.setBroadcast(true);
        sock.addMembership("224.0.0.167");
      } catch {}
    });
    setTimeout(() => stop(false), 4000);
  });

  if (!failed) console.log("ALL OK");
  setTimeout(finish, 1500);
})().catch((e) => {
  fail(e.message);
  process.exit(1);
});

let finished = false;
function finish() {
  if (finished) return;
  finished = true;
  try {
    fs.rmSync(dataDir, { recursive: true, force: true });
  } catch {}
  process.exit(failed ? 1 : 0);
}
