import { describe, expect, it } from "vitest";
import { MCP_TOOLS, resolveTrack, trackLine } from "../electron/mcp-tools";
import type { Track } from "../src/types";

function mkTrack(p: Partial<Track>): Track {
  return {
    id: p.id ?? "id1",
    title: p.title ?? "Untitled",
    artist: p.artist ?? "",
    album: p.album,
    duration: p.duration ?? 0,
    addedAt: 0,
    fav: p.fav ?? false,
    fileName: p.fileName ?? "untitled.mp3",
    fileSize: 0,
    path: p.path,
    folder: p.folder,
  };
}

const state = {
  tracks: [
    mkTrack({ id: "a", title: "Bohemian Rhapsody", artist: "Queen", album: "A Night at the Opera", fileName: "01-bohemian-rhapsody.mp3", duration: 354.7, fav: true }),
    mkTrack({ id: "b", title: "Bones", artist: "Imagine Dragons", fileName: "bones.mp3", duration: 170 }),
    mkTrack({ id: "c", title: "Radioactive", artist: "Imagine Dragons", fileName: "radio.flac", duration: 187 }),
  ],
};

describe("MCP_TOOLS", () => {
  it("имена уникальны и все схемы валидны", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of MCP_TOOLS) {
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.inputSchema.type).toBe("object");
    }
  });

  it("ключевые инструменты объявлены", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    for (const n of ["get_player_state", "play_track", "set_volume", "search_youtube", "download_track"]) {
      expect(names).toContain(n);
    }
  });
});

describe("resolveTrack", () => {
  it("находит по точному id", () => {
    expect(resolveTrack(state, { track_id: "b" })?.title).toBe("Bones");
  });

  it("неизвестный id пробуется как запрос", () => {
    expect(resolveTrack(state, { track_id: "bones" })?.id).toBe("b");
  });

  it("ищет по названию без учёта регистра", () => {
    expect(resolveTrack(state, { query: "bohemian rhapsody" })?.id).toBe("a");
    expect(resolveTrack(state, { query: "BONES" })?.id).toBe("b");
  });

  it("ищет по исполнителю и имени файла", () => {
    expect(resolveTrack(state, { query: "queen" })?.id).toBe("a");
    expect(resolveTrack(state, { query: "radio.flac" })?.id).toBe("c");
  });

  it("точное совпадение названия сильнее частичного", () => {
    const s = { tracks: [mkTrack({ id: "x", title: "Bones Extended" }), mkTrack({ id: "y", title: "Bones" })] };
    expect(resolveTrack(s, { query: "bones" })?.id).toBe("y");
  });

  it("пустой запрос и промах дают null", () => {
    expect(resolveTrack(state, { query: "  " })).toBeNull();
    expect(resolveTrack(state, { query: "нет такого трека" })).toBeNull();
    expect(resolveTrack(null, { query: "bones" })).toBeNull();
  });
});

describe("trackLine", () => {
  it("округляет длительность и приводит fav к boolean", () => {
    const line = trackLine({ id: "a", title: "T", artist: "A", album: "", duration: 12.9, fav: 1 as unknown as boolean, fileName: "", fileSize: 0 });
    expect(line.duration).toBe(13);
    expect(line.fav).toBe(true);
    expect(line).not.toHaveProperty("fileName");
  });
});
