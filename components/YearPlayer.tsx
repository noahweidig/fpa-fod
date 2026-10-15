"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

const SPEEDS = [0.5, 1, 2, 4];

export default function YearPlayer() {
  const fm = useStore((s) => s.meta?.fieldMap);
  const yb = useStore((s) => s.yearBounds);
  const sel = useStore((s) => s.filters.year);
  const anim = useStore((s) => s.anim);
  const set = (p: Partial<typeof anim>) => useStore.setState((s) => ({ anim: { ...s.anim, ...p } }));
  const [lo, hi] = sel ?? yb ?? [0, 0];

  useEffect(() => {
    if (!anim.playing) return;
    const t = setInterval(() => {
      const cur = useStore.getState().anim.year ?? lo - 1;
      set({ year: cur + 1 > hi ? lo : cur + 1 });
    }, 1000 / anim.speed);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim.playing, anim.speed, lo, hi]);

  if (!fm?.year || !yb) return null;
  const active = anim.year != null;
  return (
    <section
      className="absolute inset-x-3 bottom-3 z-10 mx-auto flex max-w-2xl flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-panel/95 px-3 py-2 text-xs shadow md:bottom-6 md:left-60 md:right-3"
      aria-label="Year animation"
    >
      <button
        className="btn whitespace-nowrap"
        onClick={() => (anim.playing ? set({ playing: false }) : set({ playing: true, year: anim.year ?? lo }))}
        aria-label={anim.playing ? "Pause animation" : "Play animation"}
      >
        {anim.playing ? "❚❚ Pause" : "▶ Play"}
      </button>
      <input
        type="range" className="min-w-24 flex-1" min={lo} max={hi} step={1} value={anim.year ?? hi}
        aria-label="Animated year"
        onChange={(e) => set({ year: Number(e.target.value) })}
      />
      <span className="w-20 text-right font-semibold tabular-nums">
        {active ? (anim.cumulative ? `${lo}–${anim.year}` : anim.year) : `${lo}–${hi}`}
      </span>
      <label className="flex items-center gap-1">
        Speed
        <select className="rounded border border-line bg-panel px-1 py-0.5" value={anim.speed} onChange={(e) => set({ speed: Number(e.target.value) })}>
          {SPEEDS.map((v) => (
            <option key={v} value={v}>{v} yr/s</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={anim.cumulative} onChange={(e) => set({ cumulative: e.target.checked })} />
        Cumulative
      </label>
      {active && (
        <button className="btn" onClick={() => set({ playing: false, year: null })}>
          Show all years
        </button>
      )}
    </section>
  );
}
