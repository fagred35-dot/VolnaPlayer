import { useEffect, useRef, useState } from "react";
import type { Track } from "../types";
import { huePairFromId } from "../lib/format";
import { getArt } from "../lib/art";

interface Props {
  track: Track;
  className?: string;
  iconClassName?: string;
}

/**
 * Обложка трека:
 * встроенная из тегов (volna://cover) → интернет (iTunes/Deezer) → градиент.
 * Если встроенная обложка не загрузилась (например, после перезапуска),
 * автоматически подставляем обложку из интернета.
 */
export default function TrackCover({ track, className = "", iconClassName = "" }: Props) {
  const [art, setArt] = useState<string | null>(null);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const backupRef = useRef<string | null>(null);
  const failedRef = useRef(false);

  useEffect(() => {
    setArt(null);
    failedRef.current = false;
  }, [track.id, track.coverHash]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    let alive = true;
    backupRef.current = null;
    failedRef.current = false;

    const loadInternet = () => {
      getArt(track).then((u) => {
        if (!alive || !u) return;
        if (failedRef.current || art === null) {
          setArt(u);
        } else {
          backupRef.current = u;
        }
      });
    };

    if (track.coverHash && window.volna) {
      setArt(`volna://cover/${track.coverHash}`);
      loadInternet();
      return () => {
        alive = false;
      };
    }
    setArt(null);
    loadInternet();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, track.id, track.coverHash, track.artist, track.title]);

  const handleImgError = () => {
    failedRef.current = true;
    const b = backupRef.current;
    if (b && b !== art) {
      backupRef.current = null;
      setArt(b);
    } else {
      setArt(null);
    }
  };

  const [h1, h2] = huePairFromId(track.id);

  return (
    <div
      ref={ref}
      className={`track-cover relative shrink-0 overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${h1} 55% 45%), hsl(${h2} 55% 32%))` }}
    >
      {art ? (
        <img
          src={art}
          alt=""
          loading="lazy"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          onError={handleImgError}
          onLoad={() => {
            failedRef.current = false;
          }}
        />
      ) : (
        <span className={`flex h-full w-full items-center justify-center ${iconClassName}`}>♪</span>
      )}
    </div>
  );
}
