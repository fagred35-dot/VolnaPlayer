// MCP-сервер Волны: Model Context Protocol поверх Streamable HTTP.
// Слушает только 127.0.0.1 — управлять плеером могут локальные ИИ-агенты
// (Claude Desktop, Cursor, любой клиент MCP). Реализован на голом node:http,
// без зависимостей: MCP — это JSON-RPC 2.0, для локального управления
// достаточно методов initialize / tools/list / tools/call.
//
// Состояние плеера рендерер присылает по каналу "mcp-state" (см. main.js),
// команды назад уходят через канал "renderer-command" как объекты {__mcp:1,...}.
const http = require("http");
const { MCP_TOOLS, trackLine, resolveTrack } = require("./mcp-tools");

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "volna", title: "Волна — музыкальный плеер", version: "1.0.0" };
const INSTRUCTIONS =
  "Control the Volna music player on this computer: browse and play the local library, " +
  "control playback and volume, manage queue and playlists, and download new music from YouTube. " +
  "Call get_player_state first to see what is currently happening.";

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
/** Ответ tools/call: контент — JSON-текст (агентам так удобнее всего) */
function toolText(payload, isError = false) {
  const out = { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  if (isError) out.isError = true;
  return out;
}
function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/** Плеер ещё не прислал состояние — агент получит понятную ошибку, а не пустоту */
function requireState(getState) {
  const s = getState();
  if (!s) throw new Error("The player UI has not reported its state yet. Try again in a couple of seconds.");
  return s;
}

function fmtTime(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* ---------- реализация каждого инструмента ---------- */
async function callTool(methods, name, args) {
  const a = args || {};
  switch (name) {
    case "get_player_state": {
      const s = requireState(methods.getState);
      return toolText({
        now_playing: s.current ? { ...trackLine(s.current), position_seconds: Math.round(s.time || 0), position: fmtTime(s.time), duration_seconds: Math.round(s.duration || 0) } : null,
        playing: !!s.playing,
        volume_percent: Math.round((s.volume ?? 0.8) * 100),
        muted: !!s.muted,
        repeat: s.repeat || "off",
        shuffle: !!s.shuffle,
        speed: s.speed ?? 1,
        equalizer: s.eq || { enabled: false, preset: "" },
        library_size: s.librarySize ?? (s.tracks ? s.tracks.length : 0),
        queue_length: Array.isArray(s.queue) ? s.queue.length : 0,
        playlists: (s.playlists || []).map((p) => ({ id: p.id, name: p.name, track_count: (p.trackIds || []).length })),
        downloads: s.downloads || [],
        sleep_timer_ends_at: s.timerEnd || null,
        music_folder: s.folder || null,
      });
    }
    case "list_tracks": {
      const s = requireState(methods.getState);
      let list = s.tracks || [];
      if (a.only_favorites) list = list.filter((t) => t.fav);
      const q = String(a.query || "").trim().toLowerCase();
      if (q) {
        list = list.filter((t) =>
          `${t.title} ${t.artist || ""} ${t.album || ""} ${t.fileName || ""}`.toLowerCase().includes(q)
        );
      }
      const offset = clamp(Math.floor(Number(a.offset) || 0), 0, 1e9);
      const limit = clamp(Math.floor(Number(a.limit) || 25), 1, 500);
      const total = list.length;
      return toolText({ total, offset, count: Math.min(limit, Math.max(0, total - offset)), tracks: list.slice(offset, offset + limit).map(trackLine) });
    }
    case "play_track":
    case "queue_track":
    case "toggle_favorite": {
      const s = requireState(methods.getState);
      const t = resolveTrack(s, a);
      if (!t) {
        return toolText({ error: `Track not found: ${a.track_id || a.query || "(empty query)"}. Use list_tracks to search the library.` }, true);
      }
      if (name === "play_track") {
        methods.sendCommand({ __mcp: 1, type: "play", id: t.id });
        return toolText({ started: trackLine(t), note: "Playback started." });
      }
      if (name === "queue_track") {
        methods.sendCommand({ __mcp: 1, type: "queue", id: t.id });
        return toolText({ queued: trackLine(t) });
      }
      methods.sendCommand({ __mcp: 1, type: "fav", id: t.id });
      return toolText({ toggled_favorite: trackLine(t), note: `Favorite flag is now ${!t.fav}.` });
    }
    case "toggle_play":
      methods.sendCommand({ __mcp: 1, type: "toggle" });
      return toolText({ ok: true });
    case "pause":
      methods.sendCommand({ __mcp: 1, type: "pause" });
      return toolText({ ok: true });
    case "resume":
      methods.sendCommand({ __mcp: 1, type: "resume" });
      return toolText({ ok: true });
    case "next_track":
      methods.sendCommand({ __mcp: 1, type: "next" });
      return toolText({ ok: true });
    case "previous_track":
      methods.sendCommand({ __mcp: 1, type: "prev" });
      return toolText({ ok: true });
    case "set_volume": {
      const pct = clamp(Math.round(Number(a.percent)), 0, 100);
      methods.sendCommand({ __mcp: 1, type: "volume", value: pct / 100 });
      return toolText({ volume_percent: pct });
    }
    case "set_muted": {
      const on = !!a.muted;
      methods.sendCommand({ __mcp: 1, type: "muted", value: on });
      return toolText({ muted: on });
    }
    case "seek": {
      const sec = Math.max(0, Number(a.seconds) || 0);
      methods.sendCommand({ __mcp: 1, type: "seek", seconds: sec });
      return toolText({ seeked_to_seconds: sec, position: fmtTime(sec) });
    }
    case "set_shuffle": {
      const on = !!a.on;
      methods.sendCommand({ __mcp: 1, type: "shuffle", value: on });
      return toolText({ shuffle: on });
    }
    case "set_repeat": {
      const mode = ["off", "all", "one"].includes(a.mode) ? a.mode : "off";
      methods.sendCommand({ __mcp: 1, type: "repeat", value: mode });
      return toolText({ repeat: mode });
    }
    case "set_speed": {
      const rate = clamp(Number(a.rate) || 1, 0.5, 2);
      methods.sendCommand({ __mcp: 1, type: "speed", value: rate });
      return toolText({ speed: rate });
    }
    case "get_queue": {
      const s = requireState(methods.getState);
      const q = Array.isArray(s.queue) ? s.queue : [];
      const items = q
        .map((id) => (s.tracks || []).find((t) => t.id === id))
        .filter(Boolean)
        .map(trackLine);
      return toolText({ count: items.length, queue: items });
    }
    case "list_playlists": {
      const s = requireState(methods.getState);
      return toolText({
        count: (s.playlists || []).length,
        playlists: (s.playlists || []).map((p) => ({ id: p.id, name: p.name, track_count: (p.trackIds || []).length })),
      });
    }
    case "play_playlist": {
      const s = requireState(methods.getState);
      const pls = s.playlists || [];
      const id = String(a.playlist_id || "");
      const byName = String(a.name || "").trim().toLowerCase();
      const pl = pls.find((p) => p.id === id) || (byName ? pls.find((p) => p.name.toLowerCase() === byName) : null);
      if (!pl) {
        return toolText({ error: `Playlist not found: ${a.playlist_id || a.name || "(empty)"}. Use list_playlists.` }, true);
      }
      if (!pl.trackIds || !pl.trackIds.length) {
        return toolText({ error: `Playlist "${pl.name}" is empty.` }, true);
      }
      methods.sendCommand({ __mcp: 1, type: "play_playlist", id: pl.id });
      return toolText({ started: pl.name, track_count: pl.trackIds.length });
    }
    case "set_sleep_timer": {
      const min = clamp(Math.floor(Number(a.minutes) || 0), 0, 1440);
      methods.sendCommand({ __mcp: 1, type: "timer", minutes: min });
      return toolText(min > 0 ? { sleep_timer_minutes: min } : { sleep_timer_cancelled: true });
    }
    case "search_youtube": {
      const query = String(a.query || "").trim();
      if (!query) return toolText({ error: "Query is empty." }, true);
      const results = await methods.youtubeSearch(query);
      return toolText({ count: results.length, results });
    }
    case "download_track": {
      const url = String(a.url || "").trim();
      let target = null;
      let title = "";
      if (url) {
        if (!/^https?:\/\//i.test(url)) return toolText({ error: "Not a valid http(s) URL." }, true);
        target = url;
        title = url;
      } else {
        const query = String(a.query || "").trim();
        if (!query) return toolText({ error: "Provide either url or query." }, true);
        const results = await methods.youtubeSearch(query);
        if (!results.length) return toolText({ error: `Nothing found on YouTube for "${query}".` }, true);
        target = results[0].url;
        title = results[0].title;
      }
      methods.sendCommand({ __mcp: 1, type: "download", url: target, title });
      return toolText({ queued_for_download: title, url: target, note: "The track will appear in the library when the download finishes." });
    }
    default:
      return toolText({ error: `Unknown tool: ${name}` }, true);
  }
}

/* ---------- JSON-RPC поверх Streamable HTTP ---------- */
async function handleMessage(methods, msg) {
  const { id, method, params } = msg || {};
  const isNotification = id === undefined || id === null;
  try {
    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        });
      case "notifications/initialized":
      case "notifications/cancelled":
        return null; // уведомление — ответа нет
      case "ping":
        return rpcResult(id, {});
      case "tools/list":
        return rpcResult(id, { tools: MCP_TOOLS });
      case "tools/call": {
        const name = params && params.name;
        if (!MCP_TOOLS.some((t) => t.name === name)) {
          return rpcError(id, -32602, `Unknown tool: ${name}`);
        }
        const result = await callTool(methods, name, params && params.arguments);
        return rpcResult(id, result);
      }
      default:
        if (typeof method === "string" && method.startsWith("notifications/")) return null;
        return isNotification ? null : rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    if (isNotification) return null;
    return rpcError(id, -32603, String((err && err.message) || err));
  }
}

/**
 * Запустить сервер. Пытается занять port, port+1… — если порт занят другим
 * экземпляром Волны, берёт следующий. Возвращает фактический порт.
 */
function startMcpServer({ port, getState, sendCommand, youtubeSearch, log }) {
  const methods = { getState, sendCommand, youtubeSearch };
  const server = http.createServer((req, res) => {
    if (req.method !== "POST" || (req.url || "").split("?")[0] !== "/mcp") {
      res.writeHead(405, { Allow: "POST", "Content-Type": "application/json" });
      res.end(JSON.stringify(rpcError(null, -32600, "POST /mcp with a JSON-RPC body only")));
      return;
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", async () => {
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(rpcError(null, -32700, "Parse error")));
        return;
      }
      const messages = Array.isArray(body) ? body : [body];
      const replies = [];
      for (const m of messages) {
        const r = await handleMessage(methods, m);
        if (r) replies.push(r);
      }
      // CORS для локальных веб-клиентов (mcp-remote и т.п.)
      const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      };
      if (req.method === "OPTIONS") {
        res.writeHead(204, headers);
        res.end();
        return;
      }
      res.writeHead(200, headers);
      res.end(JSON.stringify(Array.isArray(body) ? replies : replies[0] ?? null));
    });
  });

  return new Promise((resolve, reject) => {
    let attempt = 0;
    const tryPort = (p) => {
      server.once("error", (e) => {
        server.removeAllListeners("listening");
        if (e.code === "EADDRINUSE" && attempt < 10) {
          attempt += 1;
          tryPort(p + 1);
        } else {
          reject(e);
        }
      });
      server.once("listening", () => {
        server.removeAllListeners("error");
        if (log) log(`MCP-сервер: http://127.0.0.1:${p}/mcp`);
        resolve({ port: p, server });
      });
      server.listen(p, "127.0.0.1");
    };
    tryPort(Math.max(1024, Math.floor(Number(port) || 57624)));
  });
}

module.exports = { startMcpServer };
