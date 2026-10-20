"use client";

import { useMemo, useState } from "react";
import { MONTH_STARTS, MONTHS } from "@/lib/expressions";
import { useStore } from "@/lib/store";
import { useDuckQuery } from "@/lib/useDuckQuery";
import { Card, fmtN, muted, niceMax, Status, Tooltip, W, type Tip } from "./chartKit";

const SMOOTH = 7;
const dayLabel = (doy: number) => {
  let m = 11;
  while (m > 0 && doy < MONTH_STARTS[m]) m--;
  return `${MONTHS[m]} ${doy - MONTH_STARTS[m] + 1}`;
};

/** Fires per day of year, 7-day moving average (the day-of-year filter is ignored). */
export default function SeasonCard() {
  const hasDoy = useStore((s) => !!s.meta?.fieldMap.doy);
  const res = useDuckQuery((be, q) => be.byDoy({ ...q, filters: { ...q.filters, doy: null } }), []);
  const [tip, setTip] = useState<Tip | null>(null);
  const sm = useMemo(() => {
    const raw = res.data;
    if (!raw) return [];
    const h = Math.floor(SMOOTH / 2);
    return Array.from({ length: 365 }, (_, i) => {
      let s = 0;
      for (let k = -h; k <= h; k++) s += raw[(i + k + 365) % 365];
      return s / SMOOTH;
    });
  }, [res.data]);
  const empty = !sm.some((v) => v > 0);
  const peak = sm.reduce((m, v, i) => (v > sm[m] ? i : m), 0);
  const max = niceMax(sm[peak] ?? 0);
  const H = 140, L = 38, R = 6, T = 8, B = 18, iw = W - L - R, ih = H - T - B;
  const x = (i: number) => L + (i / 364) * iw;
  const y = (v: number) => T + ih * (1 - v / max);
  const line = sm.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  if (!hasDoy) return null;
  return (
    <Card title="Fire season" note={empty ? undefined : `Fires per day, ${SMOOTH}-day average. Peak around ${dayLabel(peak + 1)} (${sm[peak].toFixed(0)}/day).`}>
      <Status loading={res.loading} empty={empty} />
      {!empty && (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Line chart of fires per day of year">
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={T + ih * (1 - t)} y2={T + ih * (1 - t)} stroke="var(--line)" />
                <text x={L - 4} y={T + ih * (1 - t) + 3} textAnchor="end" fontSize={9} style={muted}>{fmtN(max * t)}</text>
              </g>
            ))}
            {MONTH_STARTS.map((d, i) => i % 2 === 0 && <text key={d} x={x(d - 1)} y={H - 5} fontSize={9} style={muted}>{MONTHS[i]}</text>)}
            <path d={`${line}L${x(364)},${y(0)}L${x(0)},${y(0)}Z`} fill="var(--accent)" opacity={0.15} />
            <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} />
            <rect
              x={L} y={T} width={iw} height={ih} fill="transparent"
              onMouseMove={(e) => {
                const svg = e.currentTarget.ownerSVGElement!;
                const box = svg.getBoundingClientRect();
                const i = Math.min(364, Math.max(0, Math.round(((((e.clientX - box.left) / box.width) * W - L) / iw) * 364)));
                const wrap = (svg.parentElement as HTMLElement).getBoundingClientRect();
                setTip({ x: e.clientX - wrap.left, y: e.clientY - wrap.top - 8, text: `${dayLabel(i + 1)}: ${sm[i].toFixed(1)}/day` });
              }}
              onMouseLeave={() => setTip(null)}
            />
          </svg>
          <Tooltip tip={tip} />
        </div>
      )}
    </Card>
  );
}
