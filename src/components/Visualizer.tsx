import { useEffect, useRef } from "react";
import { engine } from "../engine/AudioEngine";

interface Props {
  playing: boolean;
  accent: string;
  className?: string;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** Канвас-визуализатор. Живёт только пока открыт и играет музыка — ноль нагрузки в фоне. */
export default function Visualizer({ playing, accent, className = "" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;
    let raf = 0;
    let alive = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, r.width * dpr);
      canvas.height = Math.max(1, r.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const N = 48;
    const draw = () => {
      if (!alive) return;
      raf = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      g.clearRect(0, 0, w, h);
      if (!playingRef.current) return;
      const analyser = engine.getAnalyser();
      const data = engine.getFreq();
      if (!analyser || !data) return;
      analyser.getByteFrequencyData(data);
      const bw = w / N;
      const step = Math.max(1, Math.floor(data.length / N));
      for (let i = 0; i < N; i++) {
        let v = 0;
        for (let j = 0; j < step; j++) v += data[i * step + j];
        v /= step * 255;
        const bh = Math.max(2, v * h * 0.92);
        const x = i * bw + bw * 0.18;
        const grad = g.createLinearGradient(0, h, 0, h - bh);
        grad.addColorStop(0, `${accent}26`);
        grad.addColorStop(1, accent);
        g.fillStyle = grad;
        rr(g, x, h - bh, bw * 0.64, bh, Math.min(bw * 0.3, 6));
        g.fill();
      }
    };
    draw();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [accent]);

  return <canvas ref={ref} className={className} />;
}
