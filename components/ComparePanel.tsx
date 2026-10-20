"use client";

import { useMemo, useState } from "react";
import { MONTHS } from "@/lib/expressions";
import { useStore, type CompareState } from "@/lib/store";
import { CAT_DIMS, DIM_LABEL, type DimId } from "@/lib/types";
import { useDuckQuery } from "@/lib/useDuckQuery";
import { Card, fmtN, ink, muted, niceMax, Status, W } from "./chartKit";

type Metric = "n" | "acres";
const A_COLOR = "var(--muted)";
const B_COLOR = "var(--accent)";

function useCompare(): [CompareState, (c: CompareState) => void] {
  const yb = useStore((s) => s.yearBounds);
  const stored = useStore((s) => s.compare);
  const [y0, y1] = yb ?? [1992, 2024];
  const mid = Math.floor((y0 + y1) / 2);
  const cur = stored ?? { a: [y0, mid] as [number, number], b: [mid + 1, y1] as [number, number] };
  return [cur, (compare) => useStore.setState({ compare })];
}

function YearRange({ label, color, value, onChange }: Readonly<{ label: string; color: string; value: [number, number]; onChange: (v: [number, number]) => void }>) {
  const yb = useStore((s) => s.yearBounds) ?? [1992, 2024];
  const set = (i: 0 | 1, raw: string) => {
    const n = Math.min(yb[1], Math.max(yb[0], Math.round(Number(raw)) || yb[i]));
    const v: [number, number] = i === 0 ? [n, Math.max(n, value[1])] : [Math.min(n, value[0]), n];
    onChange(v);
  };
  const cls = "w-16 rounded border border-line bg-panel px-1 py-0.5 tabular-nums";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      <span className="w-14">Period {label}</span>
      <input type="number" className={cls} min={yb[0]} max={yb[1]} value={value[0]} onChange={(e) => set(0, e.target.value)} aria-label={`Period ${label} start year`} />
      <span>to</span>
      <input type="number" className={cls} min={yb[0]} max={yb[1]} value={value[1]} onChange={(e) => set(1, e.target.value)} aria-label={`Period ${label} end year`} />
    </div>
  );
}

const pct = (a: number, b: number) => (a === 0 ? (b === 0 ? "0%" : "new") : `${b >= a ? "+" : "−"}${Math.abs(((b - a) / a) * 100).toFixed(0)}%`);

export default function ComparePanel() {
  const fm = useStore((s) => s.meta!.fieldMap);
  const [cmp, setCmp] = useCompare();
  const dims = useMemo(() => [...CAT_DIMS.filter((d) => fm[d]), ...(fm.doy ? (["month"] as DimId[]) : [])], [fm]);
  const [dim, setDim] = useState<DimId>(dims.includes("general") ? "general" : dims[0]);
  const [metric, setMetric] = useState<Metric>("n");
  const [perYear, setPerYear] = useState(true);

  const res = useDuckQuery(
    async (be, q) => {
      const run = (p: [number, number]) => be.groupSum([dim], { ...q, filters: { ...q.filters, year: p } });
      const [a, b] = await Promise.all([run(cmp.a), run(cmp.b)]);
      return { a, b };
    },
    [dim, cmp.a[0], cmp.a[1], cmp.b[0], cmp.b[1]],
  );

  const yrsA = cmp.a[1] - cmp.a[0] + 1, yrsB = cmp.b[1] - cmp.b[0] + 1;
  const rows = useMemo(() => {
    if (!res.data) return [];
    const da = perYear ? yrsA : 1, db = perYear ? yrsB : 1;
    const m = new Map<string, { a: number; b: number }>();
    const put = (rs: typeof res.data.a, k: "a" | "b", div: number) => {
      for (const r of rs) {
        const key = String(r.keys[0]);
        if (dim === "month" && key === "0") continue;
        const e = m.get(key) ?? { a: 0, b: 0 };
        e[k] += (metric === "n" ? r.n : r.acres) / div;
        m.set(key, e);
      }
    };
    put(res.data.a, "a", da);
    put(res.data.b, "b", db);
    return [...m.entries()]
      .map(([k, v]) => ({ k, label: dim === "month" ? (MONTHS[Number(k) - 1] ?? k) : k || "(missing)", ...v }))
      .sort((x, y) => (dim === "month" ? Number(x.k) - Number(y.k) : Math.max(y.a, y.b) - Math.max(x.a, x.b)));
  }, [res.data, dim, metric, perYear, yrsA, yrsB]);

  const shown = rows.slice(0, 12);
  const tot = rows.reduce((t, r) => ({ a: t.a + r.a, b: t.b + r.b }), { a: 0, b: 0 });
  const max = niceMax(Math.max(0, ...shown.flatMap((r) => [r.a, r.b])));
  const rowH = 26, L = 112, R = 40;
  const H = shown.length * rowH + 4;
  const bar = (v: number) => Math.max(((W - L - R) * v) / max, v > 0 ? 1 : 0);
  const unit = `${metric === "n" ? "fires" : "acres"}${perYear ? " per year" : ""}`;
  const f = (v: number) => (v >= 100 ? fmtN(Math.round(v)) : v.toLocaleString(undefined, { maximumFractionDigits: 1 }));

  return (
    <Card
      title="Compare two periods"
      note="Other filters apply to both periods; the year filter is replaced by A and B."
      table={
        <table className="w-full">
          <thead><tr className="text-left text-muted"><th /><th className="text-right">A</th><th className="text-right">B</th><th className="text-right">Change</th></tr></thead>
          <tbody>
            {rows.map((r) => (<tr key={r.k}><td>{r.label}</td><td className="text-right tabular-nums">{f(r.a)}</td><td className="text-right tabular-nums">{f(r.b)}</td><td className="text-right tabular-nums">{pct(r.a, r.b)}</td></tr>))}
          </tbody>
        </table>
      }
    >
      <div className="mb-2 space-y-1">
        <YearRange label="A" color={A_COLOR} value={cmp.a} onChange={(a) => setCmp({ ...cmp, a })} />
        <YearRange label="B" color={B_COLOR} value={cmp.b} onChange={(b) => setCmp({ ...cmp, b })} />
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <select className="rounded border border-line bg-panel px-1 py-0.5" value={dim} onChange={(e) => setDim(e.target.value as DimId)} aria-label="Compare by">
          {dims.map((d) => <option key={d} value={d}>{DIM_LABEL[d]}</option>)}
        </select>
        <div className="flex gap-1" role="group" aria-label="Metric">
          <button className="btn" aria-pressed={metric === "n"} onClick={() => setMetric("n")}>Fires</button>
          {fm.size && <button className="btn" aria-pressed={metric === "acres"} onClick={() => setMetric("acres")}>Acres</button>}
        </div>
        <label className="flex items-center gap-1"><input type="checkbox" checked={perYear} onChange={(e) => setPerYear(e.target.checked)} />Per year</label>
      </div>
      <Status loading={res.loading} empty={!shown.length} />
      {shown.length > 0 && (
        <>
          <p className="mb-1 text-xs">
            Total {unit}: <b className="tabular-nums">{f(tot.a)}</b> → <b className="tabular-nums">{f(tot.b)}</b> ({pct(tot.a, tot.b)})
          </p>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Period A versus period B, ${unit}, by ${DIM_LABEL[dim].toLowerCase()}`}>
            {shown.map((r, i) => (
              <g key={r.k}>
                <text x={L - 5} y={i * rowH + 15} textAnchor="end" fontSize={9.5} style={ink}>{r.label.length > 20 ? r.label.slice(0, 19) + "…" : r.label}</text>
                <rect x={L} y={i * rowH + 3} width={bar(r.a)} height={8} rx={2} fill={A_COLOR}><title>{`A: ${f(r.a)} ${unit}`}</title></rect>
                <rect x={L} y={i * rowH + 12} width={bar(r.b)} height={8} rx={2} fill={B_COLOR}><title>{`B: ${f(r.b)} ${unit}`}</title></rect>
                <text x={W - 2} y={i * rowH + 15} textAnchor="end" fontSize={9.5} style={muted}>{pct(r.a, r.b)}</text>
              </g>
            ))}
          </svg>
          {rows.length > shown.length && <p className="text-xs text-muted">Top 12 of {rows.length.toLocaleString()} shown; all are in the data table.</p>}
        </>
      )}
    </Card>
  );
}
