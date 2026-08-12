import { useState, type CSSProperties } from "react";

interface Props {
  value: number; // 0..1
  onChange: (v: number) => void;
  className?: string;
}

export default function SeekBar({ value, onChange, className = "" }: Props) {
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? value;
  const pct = Math.min(100, Math.max(0, shown * 100));
  const style = { "--fill": `${pct}%` } as CSSProperties;
  return (
    <input
      type="range"
      min={0}
      max={1000}
      value={Math.round(shown * 1000)}
      className={`slider w-full ${className}`}
      style={style}
      onPointerDown={() => setDrag(shown)}
      onPointerUp={() => {
        setDrag(null);
      }}
      onChange={(e) => {
        const v = Number(e.target.value) / 1000;
        setDrag(v);
        onChange(v);
      }}
      aria-label="Перемотка"
    />
  );
}
