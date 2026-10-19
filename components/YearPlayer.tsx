"use client";

import { ChevronDown, ChevronUp, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

const SPEEDS = [0.5, 1, 2, 4];

export default function YearPlayer() {
  const fm = useStore((s) => s.meta?.fieldMap);
  const yb = useStore((s) => s.yearBounds);
  const sel = useStore((s) => s.filters.year);
  const anim = useStore((s) => s.anim);
  const set = (p: Partial<typeof anim>) => useStore.setState((s) => ({ anim: { ...s.anim, ...p } }));
  const [open, setOpen] = useState(false);
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
      className={`absolute bottom-3 left-3 z-10 flex items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-panel/95 px-2 py-1.5 text-xs shadow md:inset-x-auto md:bottom-6 md:left-60 md:right-3 md:mx-auto md:max-w-2xl md:flex-wrap md:px-3 md:py-2 ${open ? "max-md:right-3 max-md:flex-wrap" : ""}`}
      aria-label="Year animation"
    >
      <button
        className="btn whitespace-nowrap"
        onClick={() => (anim.playing ? set({ playing: false }) : set({ playing: true, year: anim.year ?? lo }))}
        aria-label={anim.playing ? "Pause animation" : "Play animation"}
      >
        <span className="inline-flex items-center gap-1">{anim.playing ? <><Pause size={14} aria-hidden /><span className="max-md:hidden">Pause</span></> : <><Play size={14} aria-hidden /><span className="max-md:hidden">Play</span></>}</span>
      </button>
      <input
        type="range" className={`min-w-24 flex-1 ${open ? "" : "max-md:hidden"}`} min={lo} max={hi} step={1} value={anim.year ?? hi}
        aria-label="Animated year"
        onChange={(e) => set({ year: Number(e.target.value) })}
      />
      <span className={`text-right font-semibold tabular-nums md:w-20 ${open ? "max-md:order-last" : ""}`}>
        {active ? (anim.cumulative ? `${lo}–${anim.year}` : anim.year) : `${lo}–${hi}`}
      </span>
      <label className={`items-center gap-1 ${open ? "flex" : "max-md:hidden md:flex"}`}>
        Speed
        <select className="rounded border border-line bg-panel px-1 py-0.5" value={anim.speed} onChange={(e) => set({ speed: Number(e.target.value) })}>
          {SPEEDS.map((v) => (
            <option key={v} value={v}>{v} yr/s</option>
          ))}
        </select>
      </label>
      <label className={`items-center gap-1 ${open ? "flex" : "max-md:hidden md:flex"}`}>
        <input type="checkbox" checked={anim.cumulative} onChange={(e) => set({ cumulative: e.target.checked })} />
        Cumulative
      </label>
      {active && (
        <button className={`btn ${open ? "" : "max-md:hidden"}`} onClick={() => set({ playing: false, year: null })}>
          Show all years
        </button>
      )}
      <button className="btn px-1.5 md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Collapse animation controls" : "Expand animation controls"}>
        {open ? <ChevronDown size={14} aria-hidden /> : <ChevronUp size={14} aria-hidden />}
      </button>
    </section>
  );
}
