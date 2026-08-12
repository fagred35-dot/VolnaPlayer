import { EQ_FREQS } from "../types";

/**
 * Лёгкий аудио-движок.
 * - один requestAnimationFrame-цикл, живёт только пока играет музыка
 * - эквалайзер: цепочка peaking-фильтров, при выключении gain = 0 (обход)
 * - анализатор: fftSize 256 — минимум CPU
 */
export class AudioEngine {
  readonly el: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private eq: BiquadFilterNode[] = [];
  private analyserNode: AnalyserNode | null = null;
  private freq: Uint8Array<ArrayBuffer> | null = null;
  private rafId = 0;
  private loopOn = false;
  private gainNode: GainNode | null = null;
  private trackGain = 1;

  onTime: ((t: number) => void) | null = null;
  onEnded: (() => void) | null = null;

  constructor() {
    this.el = new Audio();
    this.el.preload = "auto";
    this.el.addEventListener("ended", () => this.onEnded?.());
    this.el.addEventListener("play", () => this.startLoop());
    this.el.addEventListener("pause", () => this.stopLoop());
  }

  private ensureGraph(): void {
    if (this.ctx) return;
    const AC: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const src = ctx.createMediaElementSource(this.el);
    const gain = ctx.createGain();
    gain.gain.value = this.trackGain;
    this.gainNode = gain;
    this.eq = EQ_FREQS.map((f) => {
      const b = ctx.createBiquadFilter();
      b.type = "peaking";
      b.frequency.value = f;
      b.Q.value = 1.1;
      b.gain.value = 0;
      return b;
    });
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.82;
    const out = ctx.createGain();
    out.gain.value = 1;

    src.connect(gain);
    gain.connect(this.eq[0]);
    for (let i = 0; i < this.eq.length - 1; i++) this.eq[i].connect(this.eq[i + 1]);
    this.eq[this.eq.length - 1].connect(this.analyserNode);
    this.analyserNode.connect(out);
    out.connect(ctx.destination);
    this.freq = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.ctx = ctx;
  }

  load(url: string): void {
    this.el.src = url;
    this.el.load();
  }

  async play(): Promise<void> {
    this.ensureGraph();
    if (this.ctx && this.ctx.state === "suspended") {
      await this.ctx.resume().catch(() => undefined);
    }
    await this.el.play().catch(() => undefined);
  }

  pause(): void {
    this.el.pause();
  }

  seek(t: number): void {
    if (Number.isFinite(t)) this.el.currentTime = Math.max(0, t);
  }

  setVolume(v: number): void {
    this.el.volume = Math.min(1, Math.max(0, v));
  }

  setMuted(m: boolean): void {
    this.el.muted = m;
  }

  /** Усиление конкретного трека (0..2) — независимо от общей громкости */
  setTrackGain(v: number): void {
    this.trackGain = v;
    if (this.gainNode) this.gainNode.gain.value = v;
  }

  setSpeed(s: number): void {
    this.el.playbackRate = s;
  }

  setEQGains(gains: number[]): void {
    this.eq.forEach((b, i) => {
      if (gains[i] !== undefined) b.gain.value = gains[i];
    });
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  getFreq(): Uint8Array<ArrayBuffer> | null {
    return this.freq;
  }

  destroy(): void {
    this.stopLoop();
    this.el.pause();
    this.el.src = "";
  }

  private startLoop(): void {
    if (this.loopOn) return;
    this.loopOn = true;
    const tick = () => {
      if (!this.loopOn) return;
      this.onTime?.(this.el.currentTime);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    this.loopOn = false;
    cancelAnimationFrame(this.rafId);
  }
}

/** Синглтон — один на всё приложение */
export const engine = new AudioEngine();
