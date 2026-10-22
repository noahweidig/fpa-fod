"use client";

import { useMemo, useState } from "react";
import { dayLabel, MONTH_STARTS, MONTHS } from "@/lib/expressions";
import { useStore } from "@/lib/store";
import { useDuckQuery } from "@/lib/useDuckQuery";
import { Card, fmtN, muted, niceMax, Status, Tooltip, W, type Tip } from "./chartKit";

type Metric = "acres" | "n";

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Cumulative acres (or fires) by day of year for one year against the median of all years (the year and day filters are ignored). */
export default function SeasonProgress() {
  const ok = useStore((s) => !!(s.meta?.fieldMap.year && s.meta?.fieldMap.doy));
  const hasSize = useStore((s) => !!s.meta?.fieldMap.size);
  const [metric, setMetric] = useState<Metric>(hasSize ? "acres" : "n");
  const [year, setYear] = useState<number | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const res = useDuckQuery((be, q) => be.byYearDoy({ ...q, filters: { ...q.filters, year: null, doy: null } }), []);

  const { years, cum } = useMemo(() => {
    const by = new Map<number, number[]>();
    for (const r of res.data ?? []) {
      let a = by.get(r.year);
      if (!a) by.set(r.year, (a = Array.from({ length: 366 }, () => 0)));
      a[r.doy - 1] += metric === "acres" ? r.acres : r.n;
    }
    const years = [...by.keys()].sort((a, b) => a - b);
    const cum = new Map<number, number[]>();
    for (const y of years) {
      let s = 0;
      cum.set(y, by.get(y)!.map((v) => (s += v)));
    }
    return { years, cum };
  }, [res.data, metric]);

  const sel = year != null && cum.has(year) ? year : (years.at(-1) ?? null);
  const med = useMemo(() => (years.length ? Array.from({ length: 366 }, (_, i) => median(years.map((y) => cum.get(y)![i]))) : []), [years, cum]);
  const cur = sel != null ? cum.get(sel)! : [];
  const max = niceMax(Math.max(0, ...cur, ...med));
  const H = 150, L = 38, R = 6, T = 8, B = 18, iw = W - L - R, ih = H - T - B;
  const x = (i: number) => L + (i / 365) * iw;
  const y = (v: number) => T + ih * (1 - v / max);
  const line = (a: number[]) => a.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const unit = metric === "acres" ? "ac" : "fires";
  const total = cur[365] ?? 0;
  const half = cur.findIndex((v) => v >= total / 2);
  const medHalf = med.findIndex((v) => v >= (med[365] ?? 0) / 2);
  if (!ok) return null;

  return (
    <Card
      title="Season progress"
      note={
        sel != null && total > 0
          ? `${sel}: ${Math.round(total).toLocaleString()} ${unit}, half reached ${dayLabel(half + 1)}${med[365] > 0 ? ` (median year: ${dayLabel(medHalf + 1)})` : ""}.`
          : "Running total through the year against the median year."
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        {hasSize && (
          <fieldset className="flex gap-1">
            <legend className="sr-only">Season progress measure</legend>
            <button className="btn" aria-pressed={metric === "acres"} onClick={() => setMetric("acres")}>Acres</button>
            <button className="btn" aria-pressed={metric === "n"} onClick={() => setMetric("n")}>Fires</button>
          </fieldset>
        )}
        <label className="flex items-center gap-1">
          <span>Year</span>
          <select className="rounded border border-line bg-panel px-1 py-0.5" value={sel ?? ""} onChange={(e) => setYear(Number(e.target.value))}>
            {[...years].reverse().map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
      </div>
      <Status loading={res.loading} empty={!years.length} />
      {years.length > 0 && (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Cumulative ${metric === "acres" ? "acres burned" : "fires"} by day of year for ${sel} against the median year`}>
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={T + ih * (1 - t)} y2={T + ih * (1 - t)} stroke="var(--line)" />
                <text x={L - 4} y={T + ih * (1 - t) + 3} textAnchor="end" fontSize={9} style={muted}>{fmtN(max * t)}</text>
              </g>
            ))}
            {MONTH_STARTS.map((d, i) => (
              <text key={MONTHS[i]} x={x(d - 1 + 15)} y={H - 5} textAnchor="middle" fontSize={9} style={muted}>{MONTHS[i][0]}</text>
            ))}
            <path d={line(med)} fill="none" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 3" />
            <path d={line(cur)} fill="none" stroke="var(--accent)" strokeWidth={2} />
            <rect
              x={L} y={T} width={iw} height={ih} fill="transparent"
              onMouseMove={(e) => {
                const svg = e.currentTarget.ownerSVGElement!;
                const box = svg.getBoundingClientRect();
                const i = Math.min(365, Math.max(0, Math.round(((((e.clientX - box.left) / box.width) * W - L) / iw) * 365)));
                const wrap = (svg.parentElement as HTMLElement).getBoundingClientRect();
                const f = (v: number) => Math.round(v).toLocaleString();
                setTip({ x: e.clientX - wrap.left, y: e.clientY - wrap.top - 8, text: `${dayLabel(Math.min(i + 1, 365))}\n${sel}: ${f(cur[i])} ${unit}\nMedian: ${f(med[i])} ${unit}` });
              }}
              onMouseLeave={() => setTip(null)}
            />
          </svg>
          <Tooltip tip={tip} />
          <p className="flex gap-3 text-xs text-muted">
            <span><span className="inline-block h-0.5 w-4 bg-accent align-middle" /> {sel}</span>
            <span><span className="inline-block w-4 border-t-2 border-dashed border-muted align-middle" /> Median of {years.length} years</span>
          </p>
        </div>
      )}
    </Card>
  );
}
