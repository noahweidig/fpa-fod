"use client";

import { getMap } from "@/lib/mapInstance";
import { useStore } from "@/lib/store";
import { useDuckQuery } from "@/lib/useDuckQuery";
import { Card, Status } from "./chartKit";

/** The largest fire of each year (the year filter is ignored). Click a row to zoom to it. */
export default function LargestPerYear() {
  const fm = useStore((s) => s.meta!.fieldMap);
  const res = useDuckQuery((be, q) => be.largestPerYear({ ...q, filters: { ...q.filters, year: null } }), []);
  const rows = res.data ?? [];
  if (!fm.year || !fm.size) return null;

  const go = (lon: number, lat: number) => {
    useStore.setState({ drawer: false });
    getMap()?.flyTo({ center: [lon, lat], zoom: Math.max(getMap()!.getZoom(), 11), essential: true });
  };

  return (
    <Card title="Largest fire each year" note="By acres, for the current filters and area. Click a name to zoom to it.">
      <Status loading={res.loading} empty={!rows.length} />
      {rows.length > 0 && (
        <div className="max-h-72 overflow-auto">
          <table className="w-full table-fixed text-xs">
            <colgroup><col className="w-10" /><col /><col className="w-16" /><col className="w-9" /></colgroup>
            <thead className="sticky top-0 bg-panel text-left text-muted"><tr><th>Year</th><th>Fire</th><th className="text-right">Acres</th><th className="pl-2">St.</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.year} className="border-t border-line">
                  <td className="tabular-nums">{r.year}</td>
                  <td className="truncate pr-2">
                    <button className="text-left underline decoration-dotted underline-offset-2 hover:text-accent" onClick={() => go(r.lon, r.lat)} title={r.name || r.id}>
                      {r.name || r.id || "(unnamed)"}
                    </button>
                  </td>
                  <td className="text-right tabular-nums">{r.acres == null ? "" : Math.round(r.acres).toLocaleString()}</td>
                  <td className="pl-2">{r.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
