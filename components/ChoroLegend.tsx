"use client";

import { useEffect, useState } from "react";
import { getDuck } from "@/lib/backend";
import { choroClasses, fmtNum } from "@/lib/choroLayer";
import { buildChoro, loadGeo, METRIC_LABEL, regionDef } from "@/lib/regions";
import { useStore } from "@/lib/store";
import { useColorModel } from "@/lib/useColorModel";

/** Computes the choropleth for the applied filters (needs the Parquet) and shows its legend. */
export default function ChoroLegend() {
  const { layer, metric, ramp, reverse } = useStore((s) => s.choro);
  const applied = useStore((s) => s.applied);
  const parquet = useStore((s) => s.parquet.status);
  const res = useStore((s) => s.choroRes);
  const status = useStore((s) => s.choroStatus);
  const dark = useStore((s) => s.theme === "dark");
  const cm = useColorModel();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const set = useStore.setState;
    if (!layer) {
      set({ choroRes: null, choroStatus: { state: "idle" } });
      return;
    }
    const be = getDuck();
    if (!be) {
      set({ choroRes: null, choroStatus: parquet === "loading" ? { state: "loading", message: "Waiting for the Parquet data…" } : { state: "error", message: "Choropleths need the Parquet data (exact mode)." } });
      return;
    }
    let off = false;
    const say = (message: string) => !off && set({ choroStatus: { state: "loading", message } });
    set({ choroStatus: { state: "loading", message: "Loading boundaries…" } });
    const t = setTimeout(async () => {
      try {
        const def = regionDef(layer);
        const geo = await loadGeo(layer);
        const { rows, total } = await be.regionRows(def, geo, { filters: applied.filters, legend: applied.legend, legendCtx: cm.legendCtx, extent: null, area: applied.area }, say);
        if (!off) set({ choroRes: buildChoro(layer, metric, geo, rows, total), choroStatus: { state: "ready" } });
      } catch (e) {
        console.error(e);
        if (!off) set({ choroRes: null, choroStatus: { state: "error", message: e instanceof Error ? e.message : String(e) } });
      }
    }, 100);
    return () => {
      off = true;
      clearTimeout(t);
    };
  }, [layer, metric, applied, cm.legendCtx, parquet]);

  if (!layer) return null;
  const def = regionDef(layer);
  const classes = res && res.layer === layer ? choroClasses(res, dark, ramp, reverse) : null;
  return (
    <section className="absolute bottom-14 right-3 z-10 w-[200px] rounded-lg border border-line bg-panel/95 text-xs shadow max-md:bottom-24" aria-label="Choropleth legend">
      <button className="flex w-full items-center justify-between gap-2 px-3 py-2 font-semibold" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="truncate">{def.label}: {METRIC_LABEL[metric]}</span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-2">
          {status.state === "loading" && <p className="text-muted">{status.message}</p>}
          {status.state === "error" && <p className="text-red-700">{status.message}</p>}
          {classes && !res!.breaks.length && <p className="text-muted">No fires in any region for these filters.</p>}
          {classes && res!.breaks.length > 0 && (
            <>
              <ul className="space-y-0.5">
                {classes.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="h-3 w-5 shrink-0 rounded-sm border border-line" style={{ background: c.color }} />
                    <span>{c.hi == null ? `≥ ${fmtNum(c.lo)}` : i === 0 ? `< ${fmtNum(c.hi)}` : `${fmtNum(c.lo)} – ${fmtNum(c.hi)}`}</span>
                  </li>
                ))}
              </ul>
              {res!.unmatched > 0 && (
                <p className="mt-1 text-muted">
                  {res!.unmatched.toLocaleString()} of {res!.total.toLocaleString()} fires ({((res!.unmatched / res!.total) * 100).toFixed(1)}%) not in any {def.label} polygon
                  {layer === "county" ? " (blank or unrecognised county names)" : ""}.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
