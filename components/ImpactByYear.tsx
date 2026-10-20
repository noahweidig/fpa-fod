"use client";

import { useMemo, useState } from "react";
import { fmtImpact, impactByYear, type ImpactMetric, type YearImpact } from "@/lib/impact";
import { useDuckQuery } from "@/lib/useDuckQuery";
import { Card, fmtN, muted, niceMax, Status, Tooltip, W, type Tip } from "./chartKit";

const OPTS: { id: Extract<ImpactMetric, "str_destroyed" | "fatalities" | "injuries" | "cost" | "acres">; label: string; pick: (y: YearImpact) => number }[] = [
  { id: "str_destroyed", label: "Structures destroyed", pick: (y) => y.destroyed },
  { id: "fatalities", label: "Fatalities", pick: (y) => y.fatalities },
  { id: "injuries", label: "Injuries", pick: (y) => y.injuries },
  { id: "cost", label: "Suppression cost", pick: (y) => y.cost },
  { id: "acres", label: "Acres burned", pick: (y) => y.acres },
];

/** Impact per year over incident reports (complexes counted once). The year filter is ignored. */
export default function ImpactByYear() {
  const [id, setId] = useState<(typeof OPTS)[number]["id"]>("str_destroyed");
  const res = useDuckQuery((_, q) => impactByYear({ ...q, filters: { ...q.filters, year: null } }, false), []);
  const [tip, setTip] = useState<Tip | null>(null);
  const opt = OPTS.find((o) => o.id === id)!;
  const rows = useMemo(() => res.data ?? [], [res.data]);
  const vals = rows.map(opt.pick);
  const max = niceMax(Math.max(0, ...vals));
  const H = 140, L = 40, R = 6, T = 8, B = 18, iw = W - L - R, ih = H - T - B, bw = iw / Math.max(rows.length, 1);
  return (
    <Card
      title="Impact by year"
      note="Incident reports by start year, complexes counted once. 1999–2001 reporting is sparse, so early years read low."
      table={
        <table className="w-full"><tbody>{rows.map((r, i) => (<tr key={r.year}><td>{r.year}</td><td className="text-right tabular-nums">{fmtImpact(id, vals[i])}</td></tr>))}</tbody></table>
      }
    >
      <label className="mb-2 flex items-center gap-1 text-xs">
        <span>Show</span>
        <select className="rounded border border-line bg-panel px-1 py-0.5" value={id} onChange={(e) => setId(e.target.value as typeof id)}>
          {OPTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <Status loading={res.loading} empty={!rows.length} />
      {rows.length > 0 && (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Bar chart of ${opt.label.toLowerCase()} per year`}>
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={T + ih * (1 - t)} y2={T + ih * (1 - t)} stroke="var(--line)" />
                <text x={L - 4} y={T + ih * (1 - t) + 3} textAnchor="end" fontSize={9} style={muted}>{id === "cost" ? fmtImpact("cost", max * t) : fmtN(max * t)}</text>
              </g>
            ))}
            {rows.map((r, i) => {
              const h = (vals[i] / max) * ih;
              return (
                <g key={r.year} onMouseMove={(e) => {
                  const box = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect();
                  setTip({ x: e.clientX - box.left, y: e.clientY - box.top - 8, text: `${r.year}: ${fmtImpact(id, vals[i])}\n${r.incidents.toLocaleString()} incidents` });
                }} onMouseLeave={() => setTip(null)}>
                  <rect x={L + i * bw} y={T} width={bw} height={ih} fill="transparent" />
                  <rect x={L + i * bw + 0.5} y={T + ih - h} width={Math.max(bw - 1, 1)} height={h} fill="#b91c1c" />
                  {(r.year - rows[0].year) % 5 === 0 && <text x={L + i * bw + bw / 2} y={H - 5} textAnchor="middle" fontSize={9} style={muted}>{r.year}</text>}
                </g>
              );
            })}
          </svg>
          <Tooltip tip={tip} />
        </div>
      )}
    </Card>
  );
}
