import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDownloadQueue } from "../src/hooks/useDownloadQueue";

type Cb = (...args: unknown[]) => void;

interface Harness {
  dlStart: ReturnType<typeof vi.fn>;
  fireDone: (d: Record<string, unknown>) => void;
  fireError: (d: Record<string, unknown>) => void;
}

function setupVolna(dlStartImpl?: () => Promise<{ ok: boolean }>): Harness {
  let onDone: Cb = () => undefined;
  let onError: Cb = () => undefined;
  const dlStart = vi.fn(dlStartImpl ?? (() => new Promise<{ ok: boolean }>(() => undefined)));
  (window as unknown as { volna: unknown }).volna = {
    platform: "win32",
    onDlProgress: () => () => undefined,
    onDlDone: (cb: Cb) => {
      onDone = cb;
      return () => undefined;
    },
    onDlError: (cb: Cb) => {
      onError = cb;
      return () => undefined;
    },
    dlStart,
    dlCancel: vi.fn(async () => undefined),
    dlMeta: vi.fn(async () => null),
  };
  return {
    dlStart,
    fireDone: (d) => onDone(d),
    fireError: (d) => onError(d),
  };
}

function setupQueue(onComplete = vi.fn()) {
  return renderHook(() =>
    useDownloadQueue({ getDestDir: () => "C:\\music", onComplete })
  );
}

beforeEach(() => {
  vi.resetModules();
  (window as unknown as { volna?: unknown }).volna = undefined;
});

afterEach(() => {
  cleanup();
});

describe("useDownloadQueue", () => {
  it("starts the first waiting item and marks it downloading", async () => {
    const h = setupVolna();
    const { result } = setupQueue();
    act(() => {
      result.current.addUrl("https://youtu.be/watch?v=1");
    });
    await waitFor(() => expect(h.dlStart).toHaveBeenCalledTimes(1));
    expect(h.dlStart).toHaveBeenCalledWith("https://youtu.be/watch?v=1", "C:\\music");
    await waitFor(() => expect(result.current.items[0].state).toBe("downloading"));
  });

  it("rejects duplicate urls in the queue", async () => {
    const h = setupVolna();
    const { result } = setupQueue();
    act(() => {
      result.current.addUrl("https://x/1");
    });
    expect(result.current.addUrl("https://x/1")).toBe(false);
    await waitFor(() => expect(h.dlStart).toHaveBeenCalledTimes(1));
  });

  it("completes via dl-done: marks done and calls onComplete", async () => {
    const onComplete = vi.fn();
    const h = setupVolna();
    const { result } = setupQueue(onComplete);
    act(() => {
      result.current.addUrl("https://x/1");
    });
    await waitFor(() => expect(h.dlStart).toHaveBeenCalledTimes(1));
    act(() => {
      h.fireDone({ path: "C:\\music\\a.mp3", title: "A", artist: "X", coverHash: null });
    });
    await waitFor(() => expect(result.current.items[0].state).toBe("done"));
    expect(result.current.items[0].path).toBe("C:\\music\\a.mp3");
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ path: "C:\\music\\a.mp3", title: "A", artist: "X" })
    );
  });

  it("marks item as error via dl-error", async () => {
    const h = setupVolna();
    const { result } = setupQueue();
    act(() => {
      result.current.addUrl("https://x/1");
    });
    await waitFor(() => expect(h.dlStart).toHaveBeenCalledTimes(1));
    act(() => {
      h.fireError({ message: "boom" });
    });
    await waitFor(() => expect(result.current.items[0].state).toBe("error"));
    expect(result.current.items[0].error).toBe("boom");
  });

  it("does not get stuck when dlStart resolves without events", async () => {
    const h = setupVolna(async () => ({ ok: true }));
    const { result } = setupQueue();
    act(() => {
      result.current.addUrl("https://x/1");
    });
    await waitFor(() => expect(h.dlStart).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.items[0].state).toBe("error"));
    expect(result.current.items[0].error).toBe("No result");
  });

  it("queues the next item only after the active one finishes", async () => {
    const h = setupVolna();
    const { result } = setupQueue();
    act(() => {
      result.current.addUrl("https://x/1");
    });
    act(() => {
      result.current.addUrl("https://x/2");
    });
    await waitFor(() => expect(h.dlStart).toHaveBeenCalledTimes(1));
    act(() => {
      h.fireDone({ path: "C:\\music\\a.mp3", title: "A" });
    });
    await waitFor(() => expect(h.dlStart).toHaveBeenCalledTimes(2));
    expect(h.dlStart).toHaveBeenLastCalledWith("https://x/2", "C:\\music");
    await waitFor(() => {
      const states = result.current.items.map((i) => i.state);
      expect(states).toEqual(["done", "downloading"]);
    });
  });

  it("retry puts a failed item back into the queue", async () => {
    const h = setupVolna();
    const { result } = setupQueue();
    act(() => {
      result.current.addUrl("https://x/1");
    });
    await waitFor(() => expect(h.dlStart).toHaveBeenCalledTimes(1));
    act(() => {
      h.fireError({ message: "net" });
    });
    await waitFor(() => expect(result.current.items[0].state).toBe("error"));
    act(() => {
      result.current.retry(result.current.items[0].id);
    });
    await waitFor(() => expect(h.dlStart).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.items[0].state).toBe("downloading"));
  });

  it("clearFinished keeps waiting and downloading items", async () => {
    const h = setupVolna();
    const { result } = setupQueue();
    act(() => {
      result.current.addUrl("https://x/1");
    });
    await waitFor(() => expect(h.dlStart).toHaveBeenCalledTimes(1));
    act(() => {
      h.fireDone({ path: "C:\\a.mp3", title: "A" });
    });
    act(() => {
      result.current.addUrl("https://x/2");
    });
    await waitFor(() => expect(result.current.items.length).toBe(2));
    act(() => {
      result.current.clearFinished();
    });
    expect(result.current.items.map((i) => i.state)).toEqual(["downloading"]);
  });
});
