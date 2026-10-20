"use client";

import { useState } from "react";
import { dayLabel } from "@/lib/expressions";
import { useStore } from "@/lib/store";
import { useDuckQuery } from "@/lib/useDuckQuery";
import { Card, Status } from "./chartKit";

const LIMITS = [10, 25];

/** Days with the most ignitions. Click a row to filter to that day. */
export default function BusiestDays() {
  const fm = useStore((s) => s.meta!.fieldMap);
  const [perYear, setPerYear] = useState(true);
  const [limit, setLimit] = useState(10);
  const res = useDuckQuery(
    (be, q) => be.busiestDays({ ...q, filters: { ...q.filters, year: null, doy: null } }, limit, perYear),
    [limit, perYear],
  );
  const rows = res.data ?? [];
  if (!fm.doy) return null;

  const go = (year: number | null, doy: number) =>
    useStore.setState((s) => ({ filters: { ...s.filters, doy: [doy, doy], ...(year ? { year: [year, year] as [number, number] } : {}) } }));

  return (
    <Card
      title="Busiest days"
      note={perYear ? "Single dates with the most ignitions. Click one to filter to it." : "Day of year with the most ignitions, all years pooled. Click one to filter to it."}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        {fm.year && (
          <div className="flex gap-1" role="group" aria-label="Busiest days grouping">
            <button className="btn" aria-pressed={perYear} onClick={() => setPerYear(true)}>Single dates</button>
            <button className="btn" aria-pressed={!perYear} onClick={() => setPerYear(false)}>Day of year</button>
          </div>
        )}
        <label className="flex items-center gap-1">
          Show
          <select className="rounded border border-line bg-panel px-1 py-0.5" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {LIMITS.map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <Status loading={res.loading} empty={!rows.length} />
      {rows.length > 0 && (
        <table className="w-full text-xs">
          <thead className="text-left text-muted"><tr><th>Date</th><th className="text-right">Fires</th>{fm.size && <th className="text-right">Acres</th>}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.year}-${r.doy}`} className="border-t border-line">
                <td>
                  <button className="text-left underline decoration-dotted underline-offset-2 hover:text-accent" onClick={() => go(r.year, r.doy)}>
                    {dayLabel(r.doy)}{r.year ? `, ${r.year}` : ""}
                  </button>
                </td>
                <td className="text-right tabular-nums">{r.n.toLocaleString()}</td>
                {fm.size && <td className="text-right tabular-nums">{Math.round(r.acres).toLocaleString()}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
