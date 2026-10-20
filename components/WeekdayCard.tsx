"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useDuckQuery } from "@/lib/useDuckQuery";
import { Card, fmtN, muted, niceMax, Status, Tooltip, W, type Tip } from "./chartKit";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Fires by weekday, derived from year + day of year. */
export default function WeekdayCard() {
  const ok = useStore((s) => !!(s.meta?.fieldMap.year && s.meta?.fieldMap.doy));
  const res = useDuckQuery((be, q) => be.byWeekday(q), []);
  const [tip, setTip] = useState<Tip | null>(null);
  const n = res.data?.n ?? [];
  const human = res.data?.human ?? null;
  const total = n.reduce((a, b) => a + b, 0);
  const max = niceMax(Math.max(0, ...n));
  const H = 130, L = 38, R = 6, T = 8, B = 18, iw = W - L - R, ih = H - T - B, bw = iw / 7;
  if (!ok) return null;
  return (
    <Card title="Fires by weekday" note="Weekday from year and day of year.">
      <Status loading={res.loading} empty={!total} />
      {total > 0 && (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Bar chart of fires by weekday">
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={T + ih * (1 - t)} y2={T + ih * (1 - t)} stroke="var(--line)" />
                <text x={L - 4} y={T + ih * (1 - t) + 3} textAnchor="end" fontSize={9} style={muted}>{fmtN(max * t)}</text>
              </g>
            ))}
            {n.map((v, i) => {
              const h = (v / max) * ih;
              const share = human ? ` (${((human[i] / Math.max(v, 1)) * 100).toFixed(0)}% human)` : "";
              return (
                <g key={DAYS[i]} onMouseMove={(e) => {
                  const box = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect();
                  setTip({ x: e.clientX - box.left, y: e.clientY - box.top - 8, text: `${DAYS[i]}: ${v.toLocaleString()}${share}` });
                }} onMouseLeave={() => setTip(null)}>
                  <rect x={L + i * bw} y={T} width={bw} height={ih} fill="transparent" />
                  <rect x={L + i * bw + 3} y={T + ih - h} width={bw - 6} height={h} fill="var(--accent)" />
                  <text x={L + i * bw + bw / 2} y={H - 5} textAnchor="middle" fontSize={9} style={muted}>{DAYS[i]}</text>
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
