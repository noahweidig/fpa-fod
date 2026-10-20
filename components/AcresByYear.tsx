"use client";

import { useMemo, useState } from "react";
import { useDuckQuery } from "@/lib/useDuckQuery";
import { Card, fmtN, muted, niceMax, Status, Tooltip, W, type Tip } from "./chartKit";

/** Total acres burned per year over the full Parquet (the year filter is ignored). */
export default function AcresByYear() {
  const res = useDuckQuery((be, q) => be.groupSum(["year"], { ...q, filters: { ...q.filters, year: null } }), []);
  const [tip, setTip] = useState<Tip | null>(null);
  const rows = useMemo(
    () => (res.data ?? []).map((r) => ({ y: Number(r.keys[0]), acres: r.acres })).filter((r) => r.y > 0).sort((a, b) => a.y - b.y),
    [res.data],
  );
  const total = rows.reduce((a, r) => a + r.acres, 0);
  const peak = rows.reduce<(typeof rows)[number] | null>((m, r) => (!m || r.acres > m.acres ? r : m), null);
  const max = niceMax(peak?.acres ?? 0);
  const H = 140, L = 38, R = 6, T = 8, B = 18, iw = W - L - R, ih = H - T - B, bw = iw / Math.max(rows.length, 1);
  return (
    <Card
      title="Acres burned by year"
      note={peak ? `Peak: ${peak.y} (${Math.round(peak.acres).toLocaleString()} ac). Total ${Math.round(total).toLocaleString()} ac.` : undefined}
      table={
        <table className="w-full"><tbody>{rows.map((r) => (<tr key={r.y}><td>{r.y}</td><td className="text-right tabular-nums">{Math.round(r.acres).toLocaleString()}</td></tr>))}</tbody></table>
      }
    >
      <Status loading={res.loading} empty={!rows.length} />
      {rows.length > 0 && (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Bar chart of acres burned per year">
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={T + ih * (1 - t)} y2={T + ih * (1 - t)} stroke="var(--line)" />
                <text x={L - 4} y={T + ih * (1 - t) + 3} textAnchor="end" fontSize={9} style={muted}>{fmtN(max * t)}</text>
              </g>
            ))}
            {rows.map((r, i) => {
              const h = (r.acres / max) * ih;
              return (
                <g key={r.y} onMouseMove={(e) => {
                  const box = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect();
                  setTip({ x: e.clientX - box.left, y: e.clientY - box.top - 8, text: `${r.y}: ${Math.round(r.acres).toLocaleString()} ac` });
                }} onMouseLeave={() => setTip(null)}>
                  <rect x={L + i * bw} y={T} width={bw} height={ih} fill="transparent" />
                  <rect x={L + i * bw + 0.5} y={T + ih - h} width={Math.max(bw - 1, 1)} height={h} fill="var(--accent)" />
                  {(r.y - rows[0].y) % 5 === 0 && <text x={L + i * bw + bw / 2} y={H - 5} textAnchor="middle" fontSize={9} style={muted}>{r.y}</text>}
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
