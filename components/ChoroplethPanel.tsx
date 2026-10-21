"use client";

import { RAMPS, rampColors, type RampId } from "@/lib/palette";
import { useStore } from "@/lib/store";
import { METRIC_LABEL, REGION_DEFS, type ChoroMetric, type RegionId } from "@/lib/regions";

export default function ChoroplethPanel() {
  const { layer, metric, ramp, reverse } = useStore((s) => s.choro);
  const dark = useStore((s) => s.theme === "dark");
  const exact = useStore((s) => s.parquet.status === "ready");
  const set = (p: { layer?: RegionId | null; metric?: ChoroMetric; ramp?: RampId; reverse?: boolean }) => useStore.setState((s) => ({ choro: { ...s.choro, ...p } }));
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Choropleth</legend>
      <div className="flex flex-wrap gap-1">
        <button className="btn" aria-pressed={!layer} onClick={() => set({ layer: null })}>Off</button>
        {REGION_DEFS.map((d) => (
          <button key={d.id} className="btn" aria-pressed={layer === d.id} disabled={!exact} onClick={() => set({ layer: d.id })}>
            {d.label}
          </button>
        ))}
      </div>
      {layer && (
        <div className="mt-1 flex flex-wrap gap-1">
          {(Object.keys(METRIC_LABEL) as ChoroMetric[]).map((m) => (
            <button key={m} className="btn" aria-pressed={metric === m} onClick={() => set({ metric: m })}>{METRIC_LABEL[m]}</button>
          ))}
        </div>
      )}
      {layer && (
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between text-xs text-muted">
            <span>Palette</span>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={reverse} onChange={(e) => set({ reverse: e.target.checked })} /> Reverse
            </label>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {(Object.keys(RAMPS) as RampId[]).map((id) => (
              <button
                key={id} className="btn !px-2 !py-1 text-left text-xs" aria-pressed={ramp === id}
                onClick={() => set({ ramp: id })}
              >
                <span className="mb-1 block h-2.5 rounded-sm" style={{ background: `linear-gradient(90deg, ${rampColors(id, reverse, dark).join(",")})` }} />
                {RAMPS[id].label}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-1 text-xs text-muted">
        Follows the current filters and area. {exact ? "Ecoregion and GACC views assign each ignition to a region in your browser the first time (a few seconds)." : "Needs the Parquet data."}
        {" "}Boundaries are simplified: EPA ecoregions cover the Lower 48 only; counties match on STATE + COUNTY name.
      </p>
    </fieldset>
  );
}
