"use client";

import { useState } from "react";
import { getMap } from "@/lib/mapInstance";
import { useStore } from "@/lib/store";
import { useDuckQuery } from "@/lib/useDuckQuery";
import { MONTHS } from "@/lib/expressions";
import { monthOf } from "@/lib/backend";
import { Card, Status } from "./chartKit";

const LIMITS = [10, 25, 50, 100];

export default function TopFires() {
  const hasSize = useStore((s) => !!s.meta?.fieldMap.size);
  const [sort, setSort] = useState<"size" | "recent">(hasSize ? "size" : "recent");
  const [limit, setLimit] = useState(25);
  const res = useDuckQuery((be, q) => be.topFires(q, sort, limit), [sort, limit]);
  const rows = res.data ?? [];

  const go = (lon: number, lat: number) => {
    useStore.setState({ drawer: false });
    getMap()?.flyTo({ center: [lon, lat], zoom: Math.max(getMap()!.getZoom(), 11), essential: true });
  };

  return (
    <Card title={`Top ${limit} fires`} note={sort === "size" ? "Largest by acres." : "Most recent by discovery date."}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <div className="flex gap-1" role="group" aria-label="Sort fires">
          {hasSize && <button className="btn" aria-pressed={sort === "size"} onClick={() => setSort("size")}>Largest</button>}
          <button className="btn" aria-pressed={sort === "recent"} onClick={() => setSort("recent")}>Most recent</button>
        </div>
        <label className="flex items-center gap-1">
          Show
          <select className="rounded border border-line bg-panel px-1 py-0.5" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {LIMITS.map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <Status loading={res.loading} empty={!rows.length} />
      {rows.length > 0 && (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-panel text-left text-muted">
              <tr><th className="pr-1">#</th><th className="pr-2">Fire</th><th className="pr-2 text-right">Acres</th><th>When</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id || i} className="border-t border-line align-top">
                  <td className="pr-1 tabular-nums text-muted">{i + 1}</td>
                  <td className="pr-2">
                    <button className="text-left underline decoration-dotted underline-offset-2 hover:text-accent" onClick={() => go(r.lon, r.lat)} title="Zoom to this fire">
                      {r.name || `FOD ${r.id}`}
                    </button>
                    <div className="text-muted">{[r.county, r.state].filter(Boolean).join(", ")}{r.cause ? ` · ${r.cause}` : ""}</div>
                  </td>
                  <td className="pr-2 text-right tabular-nums">{r.acres == null ? "" : r.acres.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                  <td className="whitespace-nowrap">{r.year ?? ""}{r.doy ? ` ${MONTHS[monthOf(r.doy) - 1] ?? ""}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
