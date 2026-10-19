"use client";

import { useMemo, type ReactNode } from "react";
import { OTHER_COLOR } from "@/lib/palette";
import { DIM_LABEL, type CatDim } from "@/lib/types";
import { useDimColors } from "@/lib/useColorModel";
import { useGroup } from "@/lib/useGroup";

export const W = 360;
export const ink = { fill: "var(--ink)" } as const;
export const muted = { fill: "var(--muted)" } as const;
export function fmtN(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
  return String(n);
}

export function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  const step = [1, 2, 5].find((x) => f <= x) ?? 10;
  return step * p;
}

export interface Tip { x: number; y: number; text: string }

export function Card({ title, note, children, table }: Readonly<{ title: string; note?: string; children: ReactNode; table?: ReactNode }>) {
  return (
    <section className="rounded-lg border border-line p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {note && <p className="mb-1 text-xs text-muted">{note}</p>}
      {children}
      {table && (
        <details className="mt-1 text-xs">
          <summary className="cursor-pointer text-muted">Data table</summary>
          <div className="mt-1 max-h-40 overflow-auto">{table}</div>
        </details>
      )}
    </section>
  );
}

export function Status({ loading, empty }: Readonly<{ loading: boolean; empty: boolean }>) {
  if (loading && empty) return <p className="py-6 text-center text-xs text-muted">Loading…</p>;
  if (empty) return <p className="py-6 text-center text-xs text-muted">No fires match the current filters.</p>;
  return null;
}

export function Tooltip({ tip }: Readonly<{ tip: Tip | null }>) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-pre rounded bg-ink px-2 py-1 text-xs text-bg shadow"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.text}
    </div>
  );
}

/* ---------- 3. ranking ---------- */
export function Ranking({ dim }: Readonly<{ dim: CatDim }>) {
  const g = useGroup([dim]);
  const { colors: colorFor } = useDimColors(dim);
  const list = useMemo(
    () => (g.rows ?? []).map((r) => ({ k: String(r.keys[0]) || "(missing)", n: r.n })).sort((a, b) => b.n - a.n),
    [g.rows],
  );
  const shown = list.slice(0, 12);
  const max = shown[0]?.n ?? 1;
  const rowH = 17, L = 130, R = 44;
  const H = shown.length * rowH + 4;
  return (
    <Card
      title={`${DIM_LABEL[dim]} ranking`}
      table={
        <table className="w-full"><tbody>{list.map((r) => (<tr key={r.k}><td>{r.k}</td><td className="text-right tabular-nums">{r.n.toLocaleString()}</td></tr>))}</tbody></table>
      }
    >
      <Status loading={g.loading} empty={!shown.length} />
      {shown.length > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Ranking of ${DIM_LABEL[dim].toLowerCase()} by number of fires`}>
          {shown.map((r, i) => (
            <g key={r.k}>
              <text x={L - 5} y={i * rowH + 12} textAnchor="end" fontSize={9.5} style={ink}>{r.k.length > 24 ? r.k.slice(0, 23) + "…" : r.k}</text>
              <rect x={L} y={i * rowH + 3} width={Math.max(((W - L - R) * r.n) / max, 1)} height={11} rx={2} fill={colorFor.get(r.k) ?? (colorFor.size ? OTHER_COLOR : "var(--accent)")}>
                <title>{`${r.k}: ${r.n.toLocaleString()}`}</title>
              </rect>
              <text x={L + Math.max(((W - L - R) * r.n) / max, 1) + 4} y={i * rowH + 12} fontSize={9.5} style={muted}>{fmtN(r.n)}</text>
            </g>
          ))}
        </svg>
      )}
      {list.length > shown.length && <p className="text-xs text-muted">Top 12 of {list.length.toLocaleString()} shown.</p>}
    </Card>
  );
}

