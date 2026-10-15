"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { DIM_LABEL } from "@/lib/types";
import { useColorModel } from "@/lib/useColorModel";

export default function Legend() {
  const cm = useColorModel();
  const legend = useStore((s) => s.legend);
  const yb = useStore((s) => s.yearBounds);
  const counts = useStore((s) => s.stats.legendCounts);
  const [open, setOpen] = useState(true);

  const setLegend = (l: typeof legend) => useStore.setState({ legend: l });
  const isolate = (key: string) =>
    setLegend(legend.isolate === key ? { isolate: null, hidden: [] } : { isolate: key, hidden: [] });
  const toggleHide = (key: string) => {
    const hidden = legend.hidden.includes(key) ? legend.hidden.filter((h) => h !== key) : [...legend.hidden, key];
    setLegend({ isolate: null, hidden });
  };

  return (
    <section
      className="absolute bottom-24 left-3 md:bottom-6 z-10 max-h-[55%] w-[220px] overflow-hidden rounded-lg border border-line bg-panel/95 text-xs shadow"
      aria-label="Legend"
    >
      <button className="flex w-full items-center justify-between px-3 py-2 font-semibold" onClick={() => setOpen(!open)} aria-expanded={open}>
        {DIM_LABEL[cm.mode]}
        <span aria-hidden>{open ? "–" : "+"}</span>
      </button>
      {open && (
        <div className="max-h-[calc(55vh-40px)] overflow-y-auto px-2 pb-2">
          {cm.mode === "year" ? (
            <div className="px-1 pb-1">
              <div className="h-3 rounded" style={{ background: `linear-gradient(90deg, ${cm.ramp.join(",")})` }} />
              <div className="mt-1 flex justify-between text-muted">
                <span>{yb?.[0] ?? ""}</span>
                <span>{yb?.[1] ?? ""}</span>
              </div>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {cm.entries.map((e) => {
                const hidden = legend.hidden.includes(e.key);
                const dim = (legend.isolate && legend.isolate !== e.key) || hidden;
                return (
                  <li key={e.key} className="flex items-center gap-1">
                    <button
                      className={`flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left hover:bg-line/50 ${dim ? "opacity-40" : ""}`}
                      onClick={(ev) => (ev.shiftKey ? toggleHide(e.key) : isolate(e.key))}
                      aria-pressed={legend.isolate === e.key}
                      title="Click: isolate · Shift-click: hide"
                    >
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: e.color }} />
                      <span className={`min-w-0 flex-1 truncate ${hidden ? "line-through" : ""}`}>{e.label}</span>
                      {counts[e.key] != null && <span className="tabular-nums text-muted">{counts[e.key].toLocaleString()}</span>}
                    </button>
                    <button
                      className="rounded px-1 text-muted hover:text-ink"
                      onClick={() => toggleHide(e.key)}
                      aria-label={`${hidden ? "Show" : "Hide"} ${e.label}`}
                      aria-pressed={hidden}
                    >
                      {hidden ? "◌" : "●"}
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
          <p className="mt-2 px-1 text-[11px] text-muted">Click isolates · Shift-click or ● hides</p>
        </div>
      )}
    </section>
  );
}
