"use client";

import { Pause, Play } from "lucide-react";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

const SPEEDS = [0.5, 1, 2, 4];

/** Year animation, docked in the sidebar under the match count. */
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
  let label = `${lo}–${hi}`;
  if (active) label = anim.cumulative ? `${lo}–${anim.year}` : String(anim.year);
  const Icon = anim.playing ? Pause : Play;
  return (
    <section className="border-b border-line px-4 py-2 text-xs" aria-label="Year animation">
      <div className="flex items-center gap-2">
        <button
          className="btn grid h-8 w-8 shrink-0 place-items-center p-0"
          onClick={() => (anim.playing ? set({ playing: false }) : set({ playing: true, year: anim.year ?? lo }))}
          aria-label={anim.playing ? "Pause animation" : "Play animation"}
        >
          <Icon size={14} aria-hidden />
        </button>
        <input
          type="range" className="min-w-0 flex-1" min={lo} max={hi} step={1} value={anim.year ?? hi}
          aria-label="Animated year" onChange={(e) => set({ year: Number(e.target.value) })}
        />
        <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">{label}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="flex items-center gap-1">
          <span>Speed</span>
          <select className="rounded border border-line bg-panel px-1 py-0.5" value={anim.speed} onChange={(e) => set({ speed: Number(e.target.value) })}>
            {SPEEDS.map((v) => (
              <option key={v} value={v}>{v} yr/s</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={anim.cumulative} onChange={(e) => set({ cumulative: e.target.checked })} />
          <span>Cumulative</span>
        </label>
        {active && (
          <button className="btn ml-auto text-xs" onClick={() => set({ playing: false, year: null })}>
            Show all years
          </button>
        )}
      </div>
    </section>
  );
}
