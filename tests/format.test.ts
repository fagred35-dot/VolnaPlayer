import { describe, expect, it } from "vitest";
import { formatTime, formatTotal, huePairFromId, parseFileName, plural } from "../src/lib/format";

describe("formatTime", () => {
  it("formats seconds/minutes/hours", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(3600 + 120 + 3)).toBe("1:02:03");
  });
  it("handles invalid input", () => {
    expect(formatTime(NaN)).toBe("0:00");
    expect(formatTime(-5)).toBe("0:00");
    expect(formatTime(Infinity)).toBe("0:00");
  });
});

describe("formatTotal", () => {
  it("keeps mm:ss under an hour", () => {
    expect(formatTotal(125)).toBe("2:05");
  });
  it("uses human hours above an hour", () => {
    expect(formatTotal(3 * 3600 + 30 * 60)).toBe("3 h 30 min");
    expect(formatTotal(3 * 3600 + 30 * 60, "ru")).toBe("3 ч 30 мин");
  });
});

describe("parseFileName", () => {
  it("splits artist - title", () => {
    expect(parseFileName("Artist - Title.mp3")).toEqual({ artist: "Artist", title: "Title" });
    expect(parseFileName("Artist – Title.flac")).toEqual({ artist: "Artist", title: "Title" });
    expect(parseFileName("Artist — Title.ogg")).toEqual({ artist: "Artist", title: "Title" });
  });
  it("strips brackets", () => {
    expect(parseFileName("Artist - Song (Official Video) [HQ].mp3")).toEqual({ artist: "Artist", title: "Song" });
  });
  it("falls back to filename as title", () => {
    expect(parseFileName("Just A Song.mp3")).toEqual({ artist: "", title: "Just A Song" });
  });
  it("does not split on single-char dashes inside words", () => {
    expect(parseFileName("A-B Song.mp3")).toEqual({ artist: "", title: "A-B Song" });
  });
});

describe("plural", () => {
  const forms: [string, string, string] = ["трек", "трека", "треков"];
  it("russian plural forms", () => {
    expect(plural(1, forms)).toBe("трек");
    expect(plural(2, forms)).toBe("трека");
    expect(plural(5, forms)).toBe("треков");
    expect(plural(11, forms)).toBe("треков");
    expect(plural(21, forms)).toBe("трек");
    expect(plural(101, forms)).toBe("трек");
  });
});

describe("huePairFromId", () => {
  it("is stable and in range", () => {
    const [h1a, h2a] = huePairFromId("abc");
    const [h1b, h2b] = huePairFromId("abc");
    expect(h1a).toBe(h1b);
    expect(h2a).toBe(h2b);
    expect(h1a).toBeGreaterThanOrEqual(0);
    expect(h1a).toBeLessThan(360);
    expect(h2a).toBeGreaterThanOrEqual(0);
    expect(h2a).toBeLessThan(360);
  });
});
