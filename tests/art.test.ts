import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../src/types";

function mk(id: string, artist = "", title = ""): Track {
  return {
    id,
    title,
    artist,
    duration: 0,
    addedAt: 0,
    fav: false,
    fileName: `${id}.mp3`,
    fileSize: 1,
  };
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function loadArt() {
  return await import("../src/lib/art");
}

describe("getArt", () => {
  it("returns null without artist and title and does not fetch", async () => {
    const { getArt } = await loadArt();
    const u = await getArt(mk("a"));
    expect(u).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("queries iTunes and upgrades artwork size", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ artworkUrl100: "https://is/100x100bb.jpg" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getArt } = await loadArt();
    const u = await getArt(mk("a", "Artist", "Song"));
    expect(u).toBe("https://is/600x600bb.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("term=Artist%20Song");
  });

  it("falls back to Deezer when iTunes has no results", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ album: { cover_medium: "https://dz/c.jpg" } }] }) });
    vi.stubGlobal("fetch", fetchMock);
    const { getArt } = await loadArt();
    expect(await getArt(mk("a", "Artist", "Song"))).toBe("https://dz/c.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caches by track id and shared artist|title key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ artworkUrl100: "https://is/1x1bb.jpg" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getArt } = await loadArt();
    const first = await getArt(mk("a1", "Artist", "Song"));
    expect(first).toBe("https://is/600x600bb.jpg");
    const second = await getArt(mk("a2", "Artist", "Song"));
    expect(second).toBe(first);
    const third = await getArt(mk("a1", "Artist", "Song"));
    expect(third).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent identical queries", async () => {
    let release: (v: unknown) => void = () => undefined;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((res) => {
        release = res;
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { getArt } = await loadArt();
    const p1 = getArt(mk("a", "Artist", "Song"));
    const p2 = getArt(mk("b", "Artist", "Song"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release({
      ok: true,
      json: async () => ({ results: [{ artworkUrl100: "https://is/1x1bb.jpg" }] }),
    });
    expect(await p1).toBe("https://is/600x600bb.jpg");
    expect(await p2).toBe("https://is/600x600bb.jpg");
  });

  it("remembers empty results within the session", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const { getArt } = await loadArt();
    expect(await getArt(mk("a", "Nobody", "Nothing"))).toBeNull();
    expect(await getArt(mk("b", "Nobody", "Nothing"))).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
