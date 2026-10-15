"use client";

interface Props {
  min: number;
  max: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  step?: number;
  label: string;
}

export default function RangeSlider({ min, max, value, onChange, step = 1, label }: Props) {
  const span = Math.max(max - min, 1);
  const pct = (v: number) => ((v - min) / span) * 100;
  return (
    <div className="dual" role="group" aria-label={label}>
      <div className="track" />
      <div className="fill" style={{ left: `${pct(value[0])}%`, width: `${pct(value[1]) - pct(value[0])}%` }} />
      <input
        type="range" min={min} max={max} step={step} value={value[0]} aria-label={`${label} start`}
        onChange={(e) => onChange([Math.min(Number(e.target.value), value[1]), value[1]])}
      />
      <input
        type="range" min={min} max={max} step={step} value={value[1]} aria-label={`${label} end`}
        onChange={(e) => onChange([value[0], Math.max(Number(e.target.value), value[0])])}
      />
    </div>
  );
}
