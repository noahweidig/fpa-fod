"use client";

import { IMPACT_METRICS } from "@/lib/impact";
import { useStore } from "@/lib/store";

/** Map overlay of ICS-209-PLUS incidents sized by impact. */
export default function ImpactControls() {
  const ics = useStore((s) => !!s.parquet.ics);
  const impact = useStore((s) => s.impact);
  const incident = useStore((s) => s.filters.incident);
  const patch = useStore((s) => s.patchFilters);
  const set = (p: Partial<typeof impact>) => useStore.setState((s) => ({ impact: { ...s.impact, ...p } }));
  if (!ics) return null;
  return (
    <section>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Destructive incidents</div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={impact.on} onChange={(e) => set({ on: e.target.checked })} />
        Show incidents sized by impact
      </label>
      {impact.on && (
        <div className="mt-1 space-y-1 text-xs">
          <label className="flex items-center gap-1">
            <span>Size by</span>
            <select className="rounded border border-line bg-panel px-1 py-0.5" value={impact.metric} onChange={(e) => { const m = e.target.value as typeof impact.metric; set({ metric: m, min: IMPACT_METRICS.find((x) => x.id === m)!.min }); }}>
              {IMPACT_METRICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>At least</span>
            <input type="number" min={1} step="any" className="w-24 rounded border border-line bg-panel px-1 py-0.5 tabular-nums" value={impact.min} onChange={(e) => set({ min: Math.max(1, Number(e.target.value) || 1) })} aria-label="Minimum value" />
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={impact.members} onChange={(e) => set({ members: e.target.checked })} />
            <span>Include complex members</span>
          </label>
        </div>
      )}
      {!!incident?.length && (
        <p className="mt-1 text-xs">
          Showing ignitions of {incident.length === 1 ? "one incident" : `${incident.length} incidents`}.{" "}
          <button className="underline" onClick={() => patch({ incident: null })}>clear</button>
        </p>
      )}
      <p className="mt-1 text-xs text-muted">Incidents come from ICS-209-PLUS, placed at the reported point of origin. Click a marker for damage figures and links.</p>
    </section>
  );
}
