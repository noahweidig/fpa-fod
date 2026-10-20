"use client";

import { useState } from "react";
import { SIZE_BINS } from "@/lib/backend";
import { useStore } from "@/lib/store";
import { useDuckQuery } from "@/lib/useDuckQuery";
import { Card, fmtN, muted, niceMax, Status, Tooltip, W, type Tip } from "./chartKit";

/** Fires by acreage (log bins). Buttons filter to a size range; the acreage filter is ignored here. */
export default function SizeHistogram() {
  const hasSize = useStore((s) => !!s.meta?.fieldMap.size);
  const res = useDuckQuery((be, q) => be.bySizeBin({ ...q, filters: { ...q.filters, acres: null } }), []);
  const [tip, setTip] = useState<Tip | null>(null);
  const n = res.data ?? [];
  const total = n.reduce((a, b) => a + b, 0);
  const max = niceMax(Math.max(0, ...n));
  const H = 140, L = 38, R = 6, T = 8, B = 28, iw = W - L - R, ih = H - T - B, bw = iw / SIZE_BINS.length;
  if (!hasSize) return null;
  const pick = (i: number) => {
    const b = SIZE_BINS[i];
    useStore.setState((s) => ({ filters: { ...s.filters, acres: [b.lo, b.hi] } }));
  };
  return (
    <Card title="Fire size distribution" note="Fires by acres, log bins. Use the buttons below to filter to a size range.">
      <Status loading={res.loading} empty={!total} />
      {total > 0 && (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Bar chart of fires by acreage bin">
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={T + ih * (1 - t)} y2={T + ih * (1 - t)} stroke="var(--line)" />
                <text x={L - 4} y={T + ih * (1 - t) + 3} textAnchor="end" fontSize={9} style={muted}>{fmtN(max * t)}</text>
              </g>
            ))}
            {n.map((v, i) => {
              const h = (v / max) * ih;
              const b = SIZE_BINS[i];
              return (
                <g
                  key={b.label}
                  onMouseMove={(e) => {
                    const box = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect();
                    setTip({ x: e.clientX - box.left, y: e.clientY - box.top - 8, text: `${b.label} ac: ${v.toLocaleString()} (${((v / total) * 100).toFixed(1)}%)` });
                  }}
                  onMouseLeave={() => setTip(null)}
                >
                  <rect x={L + i * bw} y={T} width={bw} height={ih} fill="transparent" />
                  <rect x={L + i * bw + 2} y={T + ih - h} width={bw - 4} height={h} fill="var(--accent)" />
                  <text x={L + i * bw + bw / 2} y={H - 14} textAnchor="middle" fontSize={8} style={muted}>{b.label}</text>
                </g>
              );
            })}
            <text x={L + iw / 2} y={H - 3} textAnchor="middle" fontSize={8} style={muted}>acres</text>
          </svg>
          <Tooltip tip={tip} />
          <div className="mt-1 flex flex-wrap gap-1">
            {SIZE_BINS.map((b, i) => (
              <button key={b.label} className="btn text-xs" onClick={() => pick(i)} aria-label={`Filter to ${b.label} acres`}>{b.label}</button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
