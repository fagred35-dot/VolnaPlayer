// Определения MCP-инструментов Волны + чистые помощники (используются
// mcp-server.js и тестами). Без зависимостей и без electron — чтобы можно
// было юнит-тестировать отдельно.

/** Компактная строка трека для ответа агенту */
function trackLine(t) {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist || "",
    album: t.album || "",
    duration: Math.round(t.duration || 0),
    fav: !!t.fav,
  };
}

/**
 * Найти трек по track_id и/или текстовому запросу.
 * Запрос ищется без учёта регистра по названию, исполнителю, альбому и имени файла.
 * Приоритет: точный id → точное совпадение названия → первое частичное совпадение.
 */
function resolveTrack(state, { track_id, query } = {}) {
  const tracks = (state && Array.isArray(state.tracks)) ? state.tracks : [];
  if (track_id) {
    const byId = tracks.find((t) => t.id === track_id);
    if (byId) return byId;
    // id не найден — попробуем его же как запрос (агенты часто путают)
    return resolveTrack(state, { query: track_id });
  }
  const q = String(query || "").trim().toLowerCase();
  if (!q) return null;
  const score = (t) => {
    const title = (t.title || "").toLowerCase();
    if (title === q) return 3;
    if (title.startsWith(q)) return 2;
    const hay = `${title} ${(t.artist || "").toLowerCase()} ${(t.album || "").toLowerCase()} ${(t.fileName || "").toLowerCase()}`;
    return hay.includes(q) ? 1 : 0;
  };
  let best = null;
  let bestScore = 0;
  for (const t of tracks) {
    const s = score(t);
    if (s > bestScore) {
      best = t;
      bestScore = s;
    }
  }
  return best;
}

/** Описание одного инструмента: имя, когда использовать, схема аргументов */
const MCP_TOOLS = [
  {
    name: "get_player_state",
    description:
      "Get the current player state: now playing track, position, duration, playing flag, volume, muted, repeat, shuffle, speed, queue, playlists, active downloads and sleep timer. Call this first if unsure.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_tracks",
    description:
      "List tracks from the local music library. Optionally filter by a text query (matches title, artist, album or file name), favorites only, with pagination.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Filter text, e.g. track, artist or album name" },
        only_favorites: { type: "boolean", description: "Only tracks marked as favorite" },
        limit: { type: "integer", minimum: 1, maximum: 500, description: "How many tracks to return (default 25)" },
        offset: { type: "integer", minimum: 0, description: "Skip first N results (default 0)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "play_track",
    description: "Start playing a track from the library by id or by a text query.",
    inputSchema: {
      type: "object",
      properties: {
        track_id: { type: "string", description: "Track id from list_tracks" },
        query: { type: "string", description: "Text query, e.g. 'Bohemian Rhapsody' or 'Daft Punk'" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "toggle_play",
    description: "Toggle play/pause. If nothing is playing yet, starts the first track.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "pause",
    description: "Pause playback.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "resume",
    description: "Resume playback (does nothing if already playing).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "next_track",
    description: "Skip to the next track (respects the manual queue and shuffle).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "previous_track",
    description: "Go to the previous track (restarts the current one if more than 3 seconds in).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "set_volume",
    description: "Set the playback volume.",
    inputSchema: {
      type: "object",
      properties: {
        percent: { type: "integer", minimum: 0, maximum: 100, description: "Volume in percent, 0-100" },
      },
      required: ["percent"],
      additionalProperties: false,
    },
  },
  {
    name: "set_muted",
    description: "Mute or unmute playback.",
    inputSchema: {
      type: "object",
      properties: { muted: { type: "boolean", description: "true to mute, false to unmute" } },
      required: ["muted"],
      additionalProperties: false,
    },
  },
  {
    name: "seek",
    description: "Seek to an absolute position in the current track.",
    inputSchema: {
      type: "object",
      properties: {
        seconds: { type: "number", minimum: 0, description: "Position in seconds from the start" },
      },
      required: ["seconds"],
      additionalProperties: false,
    },
  },
  {
    name: "set_shuffle",
    description: "Turn shuffle mode on or off.",
    inputSchema: {
      type: "object",
      properties: { on: { type: "boolean" } },
      required: ["on"],
      additionalProperties: false,
    },
  },
  {
    name: "set_repeat",
    description: "Set repeat mode.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["off", "all", "one"], description: "off = no repeat, all = repeat queue, one = repeat track" },
      },
      required: ["mode"],
      additionalProperties: false,
    },
  },
  {
    name: "set_speed",
    description: "Set playback speed.",
    inputSchema: {
      type: "object",
      properties: {
        rate: { type: "number", minimum: 0.5, maximum: 2, description: "Playback rate, 0.5-2 (e.g. 1.25)" },
      },
      required: ["rate"],
      additionalProperties: false,
    },
  },
  {
    name: "queue_track",
    description: "Add a library track to the end of the playback queue.",
    inputSchema: {
      type: "object",
      properties: {
        track_id: { type: "string" },
        query: { type: "string", description: "Text query if no id" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_queue",
    description: "Get the manual playback queue (tracks queued via queue_track / play_next).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_playlists",
    description: "List user playlists with their track counts.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "play_playlist",
    description: "Activate a playlist and start playing its first track.",
    inputSchema: {
      type: "object",
      properties: {
        playlist_id: { type: "string" },
        name: { type: "string", description: "Playlist name (case-insensitive) if no id" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "toggle_favorite",
    description: "Toggle the favorite flag on a library track.",
    inputSchema: {
      type: "object",
      properties: {
        track_id: { type: "string" },
        query: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "set_sleep_timer",
    description: "Set a sleep timer that pauses playback after N minutes. Use minutes=0 to cancel.",
    inputSchema: {
      type: "object",
      properties: {
        minutes: { type: "integer", minimum: 0, maximum: 1440, description: "Minutes until pause, 0 cancels the timer" },
      },
      required: ["minutes"],
      additionalProperties: false,
    },
  },
  {
    name: "search_youtube",
    description:
      "Search YouTube for music (yt-dlp). Returns up to 10 results with url, title, channel, duration and thumbnail. Use download_track to actually download one.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query, e.g. 'Imagine Dragons Bones'" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "download_track",
    description:
      "Download music into the user's music folder (converted to MP3) via yt-dlp: either by a direct URL (YouTube, VK, SoundCloud, Bandcamp, 1000+ sites) or by a YouTube search query (downloads the best match). The downloaded track is added to the library automatically.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Direct page URL to download" },
        query: { type: "string", description: "YouTube search query — downloads the first result" },
      },
      additionalProperties: false,
    },
  },
];

module.exports = { MCP_TOOLS, trackLine, resolveTrack };
