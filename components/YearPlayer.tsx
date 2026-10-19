"use client";

import { Minus, Pause, Play, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

const SPEEDS = [0.5, 1, 2, 4];

function PlayPause({ open, playing, onClick }: Readonly<{ open: boolean; playing: boolean; onClick: () => void }>) {
  const Icon = playing ? Pause : Play;
  return (
    <button
      className={open ? "btn whitespace-nowrap" : "inline-flex items-center"}
      onClick={onClick}
      aria-label={playing ? "Pause animation" : "Play animation"}
    >
      <span className="inline-flex items-center gap-1">
        <Icon size={14} aria-hidden />
        <span className={open ? "max-md:hidden" : "hidden"}>{playing ? "Pause" : "Play"}</span>
      </span>
    </button>
  );
}

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
  const shown = anim.cumulative ? `${lo}–${anim.year}` : String(anim.year);
  const label = active ? shown : `${lo}–${hi}`;
  const onlyOpen = open ? "" : "hidden";
  return (
    <section
      className={`absolute bottom-3 left-3 z-10 flex items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-panel/95 px-2 py-1.5 text-xs shadow md:bottom-6 md:left-60 md:px-3 md:py-2 ${open ? "right-3 flex-wrap md:inset-x-auto md:right-3 md:mx-auto md:max-w-2xl" : "justify-between md:w-[220px]"}`}
      aria-label="Year animation"
    >
      <PlayPause
        open={open} playing={anim.playing}
        onClick={() => (anim.playing ? set({ playing: false }) : set({ playing: true, year: anim.year ?? lo }))}
      />
      <input
        type="range" className={`min-w-24 flex-1 ${onlyOpen}`} min={lo} max={hi} step={1} value={anim.year ?? hi}
        aria-label="Animated year"
        onChange={(e) => set({ year: Number(e.target.value) })}
      />
      <span className={`text-right font-semibold tabular-nums ${open ? "md:w-20 max-md:order-last" : ""}`}>
        {label}
      </span>
      <label className={`items-center gap-1 ${onlyOpen || "flex"}`}>
        Speed
        <select className="rounded border border-line bg-panel px-1 py-0.5" value={anim.speed} onChange={(e) => set({ speed: Number(e.target.value) })}>
          {SPEEDS.map((v) => (
            <option key={v} value={v}>{v} yr/s</option>
          ))}
        </select>
      </label>
      <label className={`items-center gap-1 ${onlyOpen || "flex"}`}>
        <input type="checkbox" checked={anim.cumulative} onChange={(e) => set({ cumulative: e.target.checked })} />
        Cumulative
      </label>
      {active && (
        <button className={`btn ${onlyOpen}`} onClick={() => set({ playing: false, year: null })}>
          Show all years
        </button>
      )}
      <button className={open ? "btn px-1.5" : "inline-flex items-center"} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Collapse animation controls" : "Expand animation controls"}>
        {open ? <Minus size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
      </button>
    </section>
  );
}
