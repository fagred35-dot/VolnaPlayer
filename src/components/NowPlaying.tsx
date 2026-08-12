import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { RepeatMode, Track } from "../types";
import { formatTime } from "../lib/format";
import { engine } from "../engine/AudioEngine";
import {
  IconHeart,
  IconHeartFilled,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconRepeat,
  IconRepeatOne,
  IconShuffle,
  IconSquare,
  IconVolume,
  IconX,
} from "./icons";
import SeekBar from "./SeekBar";
import TrackCover from "./TrackCover";

interface Props {
  track: Track;
  isPlaying: boolean;
  time: number;
  duration: number;
  onSeek: (v: number) => void;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  shuffle: boolean;
  onShuffle: () => void;
  repeat: RepeatMode;
  onRepeat: () => void;
  speed: number;
  onSpeed: () => void;
  onFav: (id: string) => void;
  gain: number;
  onGain: (v: number) => void;
  accent: string;
}

const ctrl =
  "rounded-xl p-2 text-white/60 transition-all hover:bg-white/[0.08] hover:text-white active:scale-90";

export default function NowPlaying(p: Props) {
  const t = p.track;
  const gainPct = Math.round(p.gain * 100);
  const [disc2d, setDisc2d] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playingRef = useRef(p.isPlaying);
  playingRef.current = p.isPlaying;

  /* фоновая визуализация в выбранном стиле */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;
    let raf = 0;
    let alive = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = Math.max(1, canvas.clientWidth * dpr);
      canvas.height = Math.max(1, canvas.clientHeight * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const N = 64;
    const draw = () => {
      if (!alive) return;
      raf = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      g.clearRect(0, 0, w, h);
      if (!playingRef.current) return;
      const a = engine.getAnalyser();
      const data = engine.getFreq();
      if (!a || !data) return;
      a.getByteFrequencyData(data);
      const step = Math.max(1, Math.floor(data.length / N));
      const vals: number[] = [];
      for (let i = 0; i < N; i++) {
        let v = 0;
        for (let j = 0; j < step; j++) v += data[i * step + j];
        vals.push(v / (step * 255));
      }
      // системная визуализация «слева» — бары на всю ширину фона, снизу,
      // с вертикальным градиентом и зеркальным отражением вниз
      const bandW = w / N;
      for (let i = 0; i < N; i++) {
        const v = vals[i];
        const bh = Math.max(3, v * h * 0.3);
        const bw = Math.max(3, bandW * 0.55);
        const x = i * bandW + (bandW - bw) / 2;
        const y0 = h - bh;
        // основной бар
        const grad = g.createLinearGradient(0, y0, 0, h);
        grad.addColorStop(0, p.accent);
        grad.addColorStop(1, p.accent + "22");
        g.globalAlpha = 0.25 + v * 0.75;
        g.fillStyle = grad;
        g.beginPath();
        g.roundRect(x, y0, bw, bh, Math.min(6, bw / 2));
        g.fill();
        // отражение вниз
        g.globalAlpha = (0.25 + v * 0.75) * 0.25;
        g.beginPath();
        g.roundRect(x, h + 2, bw, bh * 0.35, Math.min(6, bw / 2));
        g.fill();
      }
      g.globalAlpha = 1;
    };
    draw();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [p.accent]);

  return (
    <div className="anim-in bg-overlay fixed inset-0 z-50 flex flex-col overflow-hidden backdrop-blur-2xl">
      {/* фон: размытая обложка + визуализация */}
      <div className="absolute inset-0 scale-110 brightness-[0.3] blur-2xl saturate-[0.9]">
        <TrackCover track={t} className="h-full w-full text-6xl" />
      </div>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)" }}
      />

      <div className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="font-display text-sm font-bold tracking-wide text-white/70">СЕЙЧАС ИГРАЕТ</div>
        <button
          onClick={p.onClose}
          className="rounded-xl bg-black/30 p-2.5 text-white/70 backdrop-blur-md transition-all hover:bg-black/50 hover:text-white active:scale-90"
          aria-label="Закрыть"
        >
          <IconX className="h-5 w-5" />
        </button>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-4 pb-6 sm:gap-6">
        {/* Винил (3D) или плоская обложка (2D-режим) */}
        <div className="relative">
          {disc2d ? (
            <div className="h-[min(32vh,300px)] w-[min(32vh,300px)] overflow-hidden rounded-3xl shadow-[0_30px_90px_-20px_var(--accent)]">
              <TrackCover track={t} className="h-full w-full text-5xl" />
            </div>
          ) : (
            <div
              className={`disc-spin h-[min(32vh,300px)] w-[min(32vh,300px)] rounded-full shadow-[0_30px_90px_-20px_var(--accent)] ${!p.isPlaying ? "disc-paused" : ""}`}
              style={{
                background: "conic-gradient(from 0deg, #1c1f27, #2a2e38, #1c1f27, #2a2e38, #1c1f27)",
              }}
            >
              <div className="absolute inset-[5%] rounded-full bg-[#0b0e15]/90" />
              <div
                className="absolute inset-[12%] rounded-full"
                style={{ background: "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0 2px, transparent 2px 7px)" }}
              />
              <div className="absolute inset-[36%] overflow-hidden rounded-full shadow-[0_0_0_2px_rgba(255,255,255,0.15)]">
                <TrackCover track={t} className="h-full w-full text-4xl" />
              </div>
            </div>
          )}
        </div>

        <div className="max-w-[560px] px-2 text-center">
          <div className="font-display text-xl font-bold leading-tight text-white sm:text-2xl md:text-3xl">{t.title}</div>
          <div className="mt-2 text-sm font-semibold text-white/60">
            {t.artist || "Неизвестный исполнитель"}
            {t.album ? <span className="text-white/40"> · {t.album}</span> : ""}
          </div>
        </div>

        <div className="flex w-full max-w-[560px] flex-col items-center gap-3 px-2">
          <div className="flex w-full items-center gap-3">
            <span className="w-12 text-right text-xs font-semibold tabular-nums text-white/60">{formatTime(p.time)}</span>
            <SeekBar value={p.duration > 0 ? p.time / p.duration : 0} onChange={p.onSeek} />
            <span className="w-12 text-xs font-semibold tabular-nums text-white/60">{formatTime(p.duration)}</span>
          </div>

          {/* управление — по центру */}
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <button onClick={p.onShuffle} className={`${ctrl} hidden sm:block ${p.shuffle ? "text-[var(--accent)]" : ""}`} aria-label="Перемешать">
              <IconShuffle className="h-5 w-5" />
            </button>
            <button onClick={p.onPrev} className={ctrl} aria-label="Предыдущий">
              <IconPrev className="h-6 w-6" />
            </button>
            <button
              onClick={p.onToggle}
              className="flex h-13 w-13 items-center justify-center rounded-full text-white transition-all hover:scale-105 active:scale-95 sm:h-14 sm:w-14"
              style={{
                background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #22d3ee))",
                boxShadow: "0 8px 30px -8px var(--accent)",
              }}
              aria-label="Играть / Пауза"
            >
              {p.isPlaying ? <IconPause className="h-6 w-6" /> : <IconPlay className="h-6 w-6" />}
            </button>
            <button onClick={p.onNext} className={ctrl} aria-label="Следующий">
              <IconNext className="h-6 w-6" />
            </button>
            <button
              onClick={p.onRepeat}
              className={`${ctrl} hidden sm:block ${p.repeat !== "off" ? "text-[var(--accent)]" : ""}`}
              aria-label="Повтор"
            >
              {p.repeat === "one" ? <IconRepeatOne className="h-5 w-5" /> : <IconRepeat className="h-5 w-5" />}
            </button>
            <button onClick={() => p.onFav(t.id)} className={`${ctrl} ${t.fav ? "text-[var(--accent)]" : ""}`} aria-label="В избранное">
              {t.fav ? <IconHeartFilled className="h-5 w-5" /> : <IconHeart className="h-5 w-5" />}
            </button>
            <button
              onClick={() => setDisc2d((d) => !d)}
              className={`${ctrl} ${disc2d ? "text-[var(--accent)]" : ""}`}
              aria-label="2D-обложка"
              title={disc2d ? "Вернуть винил (3D)" : "Плоская обложка (2D)"}
            >
              <IconSquare className="h-5 w-5" />
            </button>
          </div>

          {/* громкость трека */}
          <div className="flex items-center justify-center gap-3">
            <IconVolume className="h-4 w-4 shrink-0 text-white/45" />
            <input
              type="range"
              min={0}
              max={100}
              value={gainPct}
              onChange={(e) => p.onGain(Number(e.target.value) / 100)}
              className="slider w-40 sm:w-48"
              style={{ "--fill": `${gainPct}%` } as CSSProperties}
              aria-label="Громкость трека"
            />
            <span className="w-11 text-xs font-bold tabular-nums text-white/60">{gainPct}%</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-bold text-white/40">
            <button onClick={p.onSpeed} className="rounded-md px-2 py-1 transition-colors hover:bg-white/[0.06] hover:text-white/70">
              скорость {p.speed}×
            </button>
            <span>пробел — пауза</span>
            <span>← → — перемотка</span>
          </div>
        </div>
      </div>
    </div>
  );
}
