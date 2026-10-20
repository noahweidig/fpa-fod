"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { CAT_DIMS, DIM_LABEL, type CatDim } from "@/lib/types";
import { useGroup } from "@/lib/useGroup";
import { Card, Status } from "./chartKit";

const TREND_DIMS = CAT_DIMS.filter((d) => d !== "county");

/** Least-squares slope of y on x. */
function slope(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den ? num / den : 0;
}

function Spark({ ys }: Readonly<{ ys: number[] }>) {
  const w = 72, h = 18, max = Math.max(...ys, 1);
  const pts = ys.map((v, i) => `${((i / Math.max(ys.length - 1, 1)) * w).toFixed(1)},${(h - 1 - (v / max) * (h - 2)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={1.3} />
    </svg>
  );
}

const sign = (v: number) => (v >= 0 ? "+" : "−");

export default function TrendsCard() {
  const fm = useStore((s) => s.meta!.fieldMap);
  const dims = TREND_DIMS.filter((d) => fm[d]);
  const [dim, setDim] = useState<CatDim>(dims.includes("general") ? "general" : dims[0]);
  const g = useGroup(["year", dim], { ignoreYear: true });

  const { years, rows, total } = useMemo(() => {
    const byKey = new Map<string, Map<number, number>>();
    const all = new Map<number, number>();
    for (const r of g.rows ?? []) {
      const y = Number(r.keys[0]);
      if (!y) continue;
      const k = String(r.keys[1]) || "(missing)";
      const m = byKey.get(k) ?? new Map<number, number>();
      m.set(y, (m.get(y) ?? 0) + r.n);
      byKey.set(k, m);
      all.set(y, (all.get(y) ?? 0) + r.n);
    }
    const ys = [...all.keys()].sort((a, b) => a - b);
    const fit = (m: Map<number, number>) => {
      const series = ys.map((y) => m.get(y) ?? 0);
      const mean = series.reduce((a, b) => a + b, 0) / (series.length || 1);
      const sl = slope(ys, series);
      return { series, mean, perDecade: sl * 10, pct: mean ? ((sl * 10) / mean) * 100 : 0 };
    };
    const out = [...byKey.entries()].map(([k, m]) => ({ k, ...fit(m) })).sort((a, b) => b.mean - a.mean);
    return { years: ys, rows: out.slice(0, 10), total: ys.length ? fit(all) : null };
  }, [g.rows]);

  const line = (label: string, r: NonNullable<typeof total>) => (
    <tr key={label} className="border-t border-line">
      <td className="max-w-[9rem] truncate pr-2" title={label}>{label}</td>
      <td className="pr-2"><Spark ys={r.series} /></td>
      <td className="pr-2 text-right tabular-nums">{Math.round(r.mean).toLocaleString()}</td>
      <td className="text-right tabular-nums">{sign(r.pct)}{Math.abs(r.pct).toFixed(0)}%</td>
    </tr>
  );

  return (
    <Card
      title="Trends"
      note={years.length ? `Fires per year, ${years[0]}–${years[years.length - 1]}. Change = linear fit per decade, as % of the yearly mean. Reporting practices changed over time, so read trends with care.` : undefined}
    >
      <select className="mb-2 rounded border border-line bg-panel px-1 py-0.5 text-xs" value={dim} onChange={(e) => setDim(e.target.value as CatDim)} aria-label="Trend by">
        {dims.map((d) => <option key={d} value={d}>{DIM_LABEL[d]}</option>)}
      </select>
      <Status loading={g.loading} empty={!rows.length} />
      {rows.length > 0 && total && (
        <table className="w-full text-xs">
          <thead className="text-left text-muted"><tr><th>{DIM_LABEL[dim]}</th><th>Trend</th><th className="text-right">Avg/yr</th><th className="text-right">Δ/decade</th></tr></thead>
          <tbody>{line("All fires", total)}{rows.map((r) => line(r.k, r))}</tbody>
        </table>
      )}
    </Card>
  );
}
