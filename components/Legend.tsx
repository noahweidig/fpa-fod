"use client";

import { Eye, EyeOff, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { DIM_LABEL } from "@/lib/types";
import { useColorModel } from "@/lib/useColorModel";

export default function Legend() {
  const cm = useColorModel();
  const legend = useStore((s) => s.legend);
  const yb = useStore((s) => s.yearBounds);
  const counts = useStore((s) => s.stats.legendCounts);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setOpen(false);
  }, []);

  const setLegend = (l: typeof legend) => useStore.setState({ legend: l });
  const isolate = (key: string) =>
    setLegend(legend.isolate === key ? { isolate: null, hidden: [] } : { isolate: key, hidden: [] });
  const toggleHide = (key: string) => {
    const hidden = legend.hidden.includes(key) ? legend.hidden.filter((h) => h !== key) : [...legend.hidden, key];
    setLegend({ isolate: null, hidden });
  };

  return (
    <section
      className={`absolute bottom-14 left-3 z-10 max-h-[45%] overflow-hidden max-md:text-[11px] md:max-h-[55%] md:bottom-6 md:w-[220px] ${open ? "max-md:w-[150px]" : "w-auto"} rounded-lg border border-line bg-panel/95 text-xs shadow`}
      aria-label="Legend"
    >
      <button className="flex w-full items-center justify-between gap-2 px-2 py-1 font-semibold md:px-3 md:py-2" onClick={() => setOpen(!open)} aria-expanded={open}>
        {DIM_LABEL[cm.mode]}
        <span aria-hidden>{open ? <Minus size={14} /> : <Plus size={14} />}</span>
      </button>
      {open && (
        <div className="max-h-[calc(45vh-32px)] overflow-y-auto px-1 pb-1 md:max-h-[calc(55vh-40px)] md:px-2 md:pb-2">
          {cm.mode === "year" ? (
            <div className="px-1 pb-1">
              <div className="h-3 rounded" style={{ background: `linear-gradient(90deg, ${cm.ramp.join(",")})` }} />
              <div className="mt-1 flex justify-between text-muted">
                <span>{yb?.[0] ?? ""}</span>
                <span>{yb?.[1] ?? ""}</span>
              </div>
            </div>
          ) : (
            <ul className="md:space-y-0.5">
              {cm.entries.map((e) => {
                const hidden = legend.hidden.includes(e.key);
                const dim = (legend.isolate && legend.isolate !== e.key) || hidden;
                return (
                  <li key={e.key} className="flex items-center gap-1">
                    <button
                      className={`flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left md:gap-2 md:py-1 hover:bg-line/50 ${dim ? "opacity-40" : ""}`}
                      onClick={(ev) => (ev.shiftKey ? toggleHide(e.key) : isolate(e.key))}
                      aria-pressed={legend.isolate === e.key}
                      title="Click: isolate · Shift-click: hide"
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full md:h-3 md:w-3" style={{ background: e.color }} />
                      <span className={`min-w-0 flex-1 truncate ${hidden ? "line-through" : ""}`}>{e.label}</span>
                      {counts[e.key] != null && <span className="tabular-nums text-muted max-md:hidden">{counts[e.key].toLocaleString()}</span>}
                    </button>
                    <button
                      className="rounded px-0.5 text-muted hover:text-ink md:px-1"
                      onClick={() => toggleHide(e.key)}
                      aria-label={`${hidden ? "Show" : "Hide"} ${e.label}`}
                      aria-pressed={hidden}
                    >
                      {hidden ? <EyeOff size={12} aria-hidden /> : <Eye size={12} aria-hidden />}
                    </button>
                  </li>
                );
              })}
              {cm.entries.length === 0 && <li className="px-1 text-muted">No categories found yet.</li>}
            </ul>
          )}
          {(legend.isolate || legend.hidden.length > 0) && (
            <button className="btn mt-2 w-full" onClick={() => setLegend({ isolate: null, hidden: [] })}>
              Show all
            </button>
          )}
          <p className="mt-2 px-1 text-[11px] text-muted max-md:hidden">Click isolates · Shift-click or the eye hides</p>
        </div>
      )}
    </section>
  );
}
