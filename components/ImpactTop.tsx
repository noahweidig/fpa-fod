"use client";

import { useState } from "react";
import { fmtImpact, IMPACT_METRICS, impactLabel, impactTop, type ImpactMetric } from "@/lib/impact";
import { focusIncident } from "@/lib/impactPopup";
import { valueOf } from "@/lib/impactLayer";
import { useDuckQuery } from "@/lib/useDuckQuery";
import { Card, Status } from "./chartKit";

const LIMITS = [10, 25, 50];

/** Most destructive incidents. Complexes count once unless members are included. */
export default function ImpactTop() {
  const [metric, setMetric] = useState<ImpactMetric>("str_destroyed");
  const [limit, setLimit] = useState(10);
  const [members, setMembers] = useState(false);
  const res = useDuckQuery((_, q) => impactTop(q, metric, limit, members), [metric, limit, members]);
  const rows = res.data ?? [];
  const m = impactLabel(metric);

  return (
    <Card title="Most destructive incidents" note={`Ranked by ${m.label.toLowerCase()}. Follows the year, state and area filters.`}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1">
          <span>Rank by</span>
          <select className="rounded border border-line bg-panel px-1 py-0.5" value={metric} onChange={(e) => setMetric(e.target.value as ImpactMetric)}>
            {IMPACT_METRICS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span>Show</span>
          <select className="rounded border border-line bg-panel px-1 py-0.5" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {LIMITS.map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={members} onChange={(e) => setMembers(e.target.checked)} />
          <span>Include complex members</span>
        </label>
      </div>
      {m.note && <p className="mb-1 text-xs text-muted">{m.note}</p>}
      {members && <p className="mb-1 text-xs text-warn">A complex and its members both report damage, so listed totals overlap.</p>}
      <Status loading={res.loading} empty={!rows.length} />
      {rows.length > 0 && (
        <div className="max-h-96 overflow-auto">
          <table className="w-full table-fixed text-xs">
            <colgroup><col className="w-6" /><col /><col className="w-16" /><col className="w-12" /></colgroup>
            <thead className="sticky top-0 bg-panel text-left text-muted">
              <tr><th>#</th><th>Incident</th><th className="text-right">{m.label.split(" ")[0]}</th><th className="text-right">Deaths</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="tabular-nums text-muted">{i + 1}</td>
                  <td className="pr-2">
                    <button className="block max-w-full truncate text-left underline decoration-dotted underline-offset-2 hover:text-accent" onClick={() => void focusIncident(r, true)} title="Show only this incident's ignitions">
                      {r.name || r.id}
                    </button>
                    <span className="text-muted">
                      {r.year}{r.state ? `, ${r.state}` : ""} · {r.fodNRollup.toLocaleString()} ign. · {r.mtbsNRollup.toLocaleString()} perim.
                      {r.nMembers ? ` · complex of ${r.nMembers}` : ""}{r.parentId ? " · member" : ""}
                      {r.qa.includes("destroyed_vs_acres") ? " · check data" : ""}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{fmtImpact(metric, valueOf(r, metric))}</td>
                  <td className="text-right tabular-nums">{fmtImpact("fatalities", r.fatalities)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
