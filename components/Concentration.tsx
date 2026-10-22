"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useDuckQuery } from "@/lib/useDuckQuery";
import { Card, muted, Status, Tooltip, W, type Tip } from "./chartKit";

const TOPS = [0.1, 1, 5, 10, 50];
const pct = (v: number) => (v >= 99.95 ? "100" : v >= 10 ? v.toFixed(0) : v.toFixed(1)) + "%";

/** How much of the burned area comes from the largest fires. */
export default function Concentration() {
  const hasSize = useStore((s) => !!s.meta?.fieldMap.size);
  const res = useDuckQuery((be, q) => be.concentration(q), []);
  const [tip, setTip] = useState<Tip | null>(null);
  const d = res.data;
  const H = 150, L = 34, R = 8, T = 8, B = 22, iw = W - L - R, ih = H - T - B;
  const x = (p: number) => L + p * iw;
  const y = (p: number) => T + ih * (1 - p);
  // x is a log scale from 0.1% to 100% of fires so the few giant fires stay visible
  const lx = (k: number) => x(Math.log10(k + 1) / 3);
  if (!hasSize) return null;
  const pts = d ? d.curve.map((v, k) => `${k ? "L" : "M"}${lx(k).toFixed(1)},${y(v).toFixed(1)}`).join("") : "";

  return (
    <Card
      title="Acreage concentration"
      note={d ? `Half of all acres burned come from the largest ${d.fires50.toLocaleString()} of ${d.n.toLocaleString()} fires (${pct((d.fires50 / d.n) * 100)}). 90% come from ${d.fires90.toLocaleString()}.` : "Share of acres burned by the largest fires."}
      table={
        d && (
          <table className="w-full"><tbody>{TOPS.map((t) => (<tr key={t}><td>Largest {t}% of fires</td><td className="text-right tabular-nums">{pct(d.curve[Math.max(0, Math.round(t * 10) - 1)] * 100)} of acres</td></tr>))}</tbody></table>
        )
      }
    >
      <Status loading={res.loading} empty={!d} />
      {d && (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cumulative share of acres burned against share of fires, largest fires first, log scale">
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" />
                <text x={L - 4} y={y(t) + 3} textAnchor="end" fontSize={9} style={muted}>{t * 100}%</text>
              </g>
            ))}
            {[0.1, 1, 10, 100].map((t) => (
              <text key={t} x={lx(t * 10 - 1)} y={H - 6} textAnchor="middle" fontSize={9} style={muted}>{t}%</text>
            ))}
            <path d={pts} fill="none" stroke="var(--accent)" strokeWidth={2} />
            <rect
              x={L} y={T} width={iw} height={ih} fill="transparent"
              onMouseMove={(e) => {
                const svg = e.currentTarget.ownerSVGElement!;
                const box = svg.getBoundingClientRect();
                const u = ((((e.clientX - box.left) / box.width) * W - L) / iw);
                const k = Math.min(999, Math.max(0, Math.round(10 ** (u * 3) - 1)));
                const wrap = (svg.parentElement as HTMLElement).getBoundingClientRect();
                setTip({ x: e.clientX - wrap.left, y: e.clientY - wrap.top - 8, text: `Largest ${pct((k + 1) / 10)} of fires: ${pct(d.curve[k] * 100)} of acres` });
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
