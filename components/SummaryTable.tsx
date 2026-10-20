"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import type { StatRow } from "@/lib/backend";
import { saveTableCsv } from "@/lib/export";
import { useStore } from "@/lib/store";
import { CAT_DIMS, DIM_LABEL, type CatDim } from "@/lib/types";
import { useColorModel } from "@/lib/useColorModel";
import { useDuckQuery } from "@/lib/useDuckQuery";
import { Card, Status } from "./chartKit";

type SortKey = "key" | "n" | "acres" | "avg" | "human";
const SHOWN = 100;

const avg = (r: StatRow) => (r.n ? r.acres / r.n : 0);
const humanPct = (r: StatRow) => (r.human == null || !r.n ? null : (r.human / r.n) * 100);
const f0 = (v: number) => Math.round(v).toLocaleString();

export default function SummaryTable() {
  const fm = useStore((s) => s.meta!.fieldMap);
  const applied = useStore((s) => s.applied);
  const cm = useColorModel();
  const dims = CAT_DIMS.filter((d) => fm[d]);
  const [dim, setDim] = useState<CatDim>(dims.includes("state") ? "state" : dims[0]);
  const [sort, setSort] = useState<SortKey>("n");
  const [asc, setAsc] = useState(false);
  const res = useDuckQuery((be, q) => be.groupStats(dim, q), [dim]);

  const rows = useMemo(() => {
    const v = [...(res.data ?? [])];
    const val = (r: StatRow) => (sort === "key" ? r.key : sort === "avg" ? avg(r) : sort === "human" ? (humanPct(r) ?? -1) : sort === "acres" ? r.acres : r.n);
    v.sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
      return asc ? c : -c;
    });
    return v;
  }, [res.data, sort, asc]);

  const hasHuman = rows.some((r) => r.human != null);
  const hasAcres = !!fm.size;
  const head = (k: SortKey, label: string, right = true) => (
    <th className={right ? "text-right" : ""}>
      <button className="font-semibold" onClick={() => { if (sort === k) setAsc(!asc); else { setSort(k); setAsc(k === "key"); } }} aria-label={`Sort by ${label}`}>
        {label}{sort === k ? (asc ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );

  const filterTo = (key: string) => {
    if (!key) return;
    useStore.setState((s) => ({ filters: { ...s.filters, cats: { ...s.filters.cats, [dim]: [key] } } }));
  };
  const download = () =>
    saveTableCsv(
      `fod-by-${dim}`,
      [DIM_LABEL[dim], "fires", ...(hasAcres ? ["acres", "mean_acres", "largest_acres"] : []), ...(hasHuman ? ["human_caused_pct"] : [])],
      rows.map((r) => [
        r.key, r.n,
        ...(hasAcres ? [Math.round(r.acres * 10) / 10, Math.round(avg(r) * 10) / 10, r.maxAcres] : []),
        ...(hasHuman ? [humanPct(r)?.toFixed(1) ?? ""] : []),
      ]),
      { filters: applied.filters, legend: applied.legend, legendCtx: cm.legendCtx, extent: null, area: applied.area },
    );

  return (
    <Card title="Summary table" note="All fires matching the current filters. Click a name to filter to it.">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <select className="rounded border border-line bg-panel px-1 py-0.5" value={dim} onChange={(e) => setDim(e.target.value as CatDim)} aria-label="Summarize by">
          {dims.map((d) => <option key={d} value={d}>{DIM_LABEL[d]}</option>)}
        </select>
        <button className="btn inline-flex items-center gap-1" onClick={download} disabled={!rows.length}><Download size={14} aria-hidden /> CSV</button>
      </div>
      <Status loading={res.loading} empty={!rows.length} />
      {rows.length > 0 && (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-panel text-left text-muted">
              <tr>
                {head("key", DIM_LABEL[dim], false)}{head("n", "Fires")}
                {hasAcres && head("acres", "Acres")}{hasAcres && head("avg", "Mean")}{hasHuman && head("human", "Human")}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, SHOWN).map((r) => {
                const hp = humanPct(r);
                return (
                  <tr key={r.key} className="border-t border-line">
                    <td className="max-w-[8rem] truncate pr-2">
                      <button className="text-left underline decoration-dotted underline-offset-2 hover:text-accent" onClick={() => filterTo(r.key)} title={`Filter to ${r.key || "(missing)"}`}>
                        {r.key || "(missing)"}
                      </button>
                    </td>
                    <td className="pr-2 text-right tabular-nums">{r.n.toLocaleString()}</td>
                    {hasAcres && <td className="pr-2 text-right tabular-nums">{f0(r.acres)}</td>}
                    {hasAcres && <td className="pr-2 text-right tabular-nums">{avg(r).toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>}
                    {hasHuman && <td className="text-right tabular-nums">{hp == null ? "" : `${hp.toFixed(0)}%`}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > SHOWN && <p className="text-xs text-muted">Top {SHOWN} of {rows.length.toLocaleString()} shown; the CSV has all rows. Mean = mean acres per fire; Human = share of human-caused fires.</p>}
      {rows.length > 0 && rows.length <= SHOWN && <p className="text-xs text-muted">Mean = mean acres per fire; Human = share of human-caused fires.</p>}
    </Card>
  );
}
