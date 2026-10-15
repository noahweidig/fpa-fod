"use client";

import { useMemo, useState, type ReactNode } from "react";
import { MONTHS } from "@/lib/expressions";
import { lerpColor, OTHER_COLOR, seqRamp } from "@/lib/palette";
import { useStore } from "@/lib/store";
import { DIM_LABEL, OTHER, type CatDim, type DimId } from "@/lib/types";
import { useColorModel, useDimColors } from "@/lib/useColorModel";
import { useGroup } from "@/lib/useGroup";

const W = 360;
const ink = { fill: "var(--ink)" } as const;
const muted = { fill: "var(--muted)" } as const;
const fmtN = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(n));

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

interface Tip { x: number; y: number; text: string }

function Card({ title, note, children, table }: { title: string; note?: string; children: ReactNode; table?: ReactNode }) {
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

function Status({ loading, empty }: { loading: boolean; empty: boolean }) {
  if (loading && empty) return <p className="py-6 text-center text-xs text-muted">Loading…</p>;
  if (empty) return <p className="py-6 text-center text-xs text-muted">No fires match the current filters.</p>;
  return null;
}

function Tooltip({ tip }: { tip: Tip | null }) {
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

/** chart dimension: the current categorical color mode, else general cause */
function useChartDim(): CatDim {
  const mode = useStore((s) => s.colorMode);
  const fm = useStore((s) => s.meta!.fieldMap);
  if (mode !== "year" && mode !== "month" && fm[mode]) return mode;
  return fm.general ? "general" : fm.classification ? "classification" : "state";
}

/* ---------- 1. fires per year by cause (stacked) ---------- */
function YearStack({ dim }: { dim: CatDim }) {
  const g = useGroup(["year", dim], { ignoreYear: true });
  const sel = useStore((s) => s.filters.year);
  const animYear = useStore((s) => s.anim.year);
  const [tip, setTip] = useState<Tip | null>(null);
  const { colors: colorFor, entries } = useDimColors(dim);
  const keys = useMemo(() => entries.map((e) => e.key), [entries]);

  const { years, stacks, max, keyList } = useMemo(() => {
    const byYear = new Map<number, Map<string, number>>();
    const kl = new Set<string>();
    for (const r of g.rows ?? []) {
      const y = Number(r.keys[0]);
      if (!y) continue;
      const raw = String(r.keys[1]);
      const k = colorFor.has(raw) ? raw : OTHER;
      kl.add(k);
      const m = byYear.get(y) ?? new Map();
      m.set(k, (m.get(k) ?? 0) + r.n);
      byYear.set(y, m);
    }
    const ys = [...byYear.keys()].sort((a, b) => a - b);
    let mx = 0;
    for (const m of byYear.values()) mx = Math.max(mx, [...m.values()].reduce((a, b) => a + b, 0));
    const ordered = [...(keys.length ? keys : [...kl])].filter((k) => kl.has(k));
    return { years: ys, stacks: byYear, max: niceMax(mx), keyList: ordered };
  }, [g.rows, colorFor, keys]);

  const H = 170, L = 38, R = 6, T = 8, B = 20;
  const iw = W - L - R, ih = H - T - B;
  const bw = years.length ? iw / years.length : 0;
  const y0 = years[0];
  return (
    <Card
      title={`Fires per year by ${DIM_LABEL[dim].toLowerCase()}`}
      note="Shows all years; the selected range is highlighted."
      table={
        <table className="w-full">
          <tbody>
            {years.map((y) => (
              <tr key={y}><td>{y}</td><td className="text-right tabular-nums">{[...(stacks.get(y)?.values() ?? [])].reduce((a, b) => a + b, 0).toLocaleString()}</td></tr>
            ))}
          </tbody>
        </table>
      }
    >
      <Status loading={g.loading} empty={!years.length} />
      {years.length > 0 && (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Stacked bar chart of fires per year by cause">
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={T + ih * (1 - t)} y2={T + ih * (1 - t)} stroke="var(--line)" strokeWidth={1} />
                <text x={L - 4} y={T + ih * (1 - t) + 3} textAnchor="end" fontSize={9} style={muted}>{fmtN(max * t)}</text>
              </g>
            ))}
            {years.map((y, i) => {
              let acc = 0;
              const inSel = !sel || (y >= sel[0] && y <= sel[1]);
              const x = L + i * bw;
              const m = stacks.get(y)!;
              const total = [...m.values()].reduce((a, b) => a + b, 0);
              return (
                <g
                  key={y}
                  opacity={animYear != null && y !== animYear ? 0.45 : inSel ? 1 : 0.28}
                  onMouseMove={(e) => {
                    const r = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect();
                    setTip({ x: e.clientX - r.left, y: e.clientY - r.top - 8, text: `${y}: ${total.toLocaleString()}\n${keyList.map((k) => `${k === OTHER ? "Other / missing" : k}: ${(m.get(k) ?? 0).toLocaleString()}`).filter((_, j) => m.get(keyList[j])).slice(0, 6).join("\n")}` });
                  }}
                  onMouseLeave={() => setTip(null)}
                >
                  <rect x={x} y={T} width={bw} height={ih} fill="transparent" />
                  {keyList.map((k) => {
                    const v = m.get(k) ?? 0;
                    if (!v) return null;
                    const h = (v / max) * ih;
                    acc += h;
                    return <rect key={k} x={x + 0.5} width={Math.max(bw - 1, 1)} y={T + ih - acc} height={Math.max(h - 1, 0.5)} fill={colorFor.get(k) ?? OTHER_COLOR} />;
                  })}
                </g>
              );
            })}
            {years.map((y, i) => (y - y0) % 5 === 0 && (
              <text key={y} x={L + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize={9} style={muted}>{y}</text>
            ))}
          </svg>
          <Tooltip tip={tip} />
        </div>
      )}
    </Card>
  );
}

/* ---------- 2. month x cause heatmap ---------- */
function MonthHeat({ dim }: { dim: CatDim }) {
  const cm = useColorModel();
  const g = useGroup(["month", dim]);
  const [tip, setTip] = useState<Tip | null>(null);
  const { colors: colorFor, entries } = useDimColors(dim);
  const rowsKeys = useMemo(() => entries.map((e) => e.key), [entries]);
  const dark = cm.dark;

  const { cells, rowList, max } = useMemo(() => {
    const cells = new Map<string, number>();
    const seen = new Set<string>();
    let mx = 0;
    for (const r of g.rows ?? []) {
      const mo = Number(r.keys[0]);
      if (!mo) continue;
      const raw = String(r.keys[1]);
      const k = colorFor.has(raw) ? raw : OTHER;
      seen.add(k);
      const id = `${k}|${mo}`;
      const v = (cells.get(id) ?? 0) + r.n;
      cells.set(id, v);
      mx = Math.max(mx, v);
    }
    return { cells, max: mx, rowList: rowsKeys.filter((k) => seen.has(k)) };
  }, [g.rows, colorFor, rowsKeys]);

  const ramp = useMemo(() => seqRamp(2, false), []);
  const L = 104, T = 14, cw = (W - L - 4) / 12, ch = 16;
  const H = T + rowList.length * ch + 4;
  return (
    <Card title={`Month × ${DIM_LABEL[dim].toLowerCase()}`} note="Darker = more fires. Month from day of year (approximate).">
      <Status loading={g.loading} empty={!rowList.length} />
      {rowList.length > 0 && (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Heatmap of fires by month and cause">
            {MONTHS.map((m, i) => (
              <text key={m} x={L + i * cw + cw / 2} y={10} textAnchor="middle" fontSize={8.5} style={muted}>{m[0]}</text>
            ))}
            {rowList.map((k, ri) => (
              <g key={k}>
                <text x={L - 5} y={T + ri * ch + ch / 2 + 3} textAnchor="end" fontSize={9} style={ink}>
                  {(k === OTHER ? "Other / missing" : k).slice(0, 19)}
                </text>
                {MONTHS.map((m, mi) => {
                  const v = cells.get(`${k}|${mi + 1}`) ?? 0;
                  const t = max ? Math.sqrt(v / max) : 0;
                  return (
                    <rect
                      key={m} x={L + mi * cw + 0.5} y={T + ri * ch + 0.5} width={cw - 1} height={ch - 1} rx={2}
                      fill={v ? lerpColor(dark ? "#1f3556" : ramp[0], dark ? "#9cc7ff" : ramp[1], t) : "var(--line)"}
                      opacity={v ? 1 : 0.4}
                      onMouseMove={(e) => {
                        const r = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect();
                        setTip({ x: e.clientX - r.left, y: e.clientY - r.top - 8, text: `${k === OTHER ? "Other / missing" : k}, ${m}: ${v.toLocaleString()}` });
                      }}
                      onMouseLeave={() => setTip(null)}
                    />
                  );
                })}
              </g>
            ))}
          </svg>
          <Tooltip tip={tip} />
        </div>
      )}
    </Card>
  );
}

/* ---------- 3. ranking ---------- */
function Ranking({ dim }: { dim: CatDim }) {
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
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Ranking of causes by number of fires">
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

/* ---------- 4. size class distribution ---------- */
function SizeClasses() {
  const g = useGroup(["sizeClass"]);
  const rows = useMemo(() => (g.rows ?? []).map((r) => ({ k: String(r.keys[0]), n: r.n })).filter((r) => r.k).sort((a, b) => a.k.localeCompare(b.k)), [g.rows]);
  const max = niceMax(Math.max(0, ...rows.map((r) => r.n)));
  const H = 130, L = 38, T = 8, B = 18, iw = W - L - 6, ih = H - T - B;
  const bw = rows.length ? iw / rows.length : 0;
  return (
    <Card
      title="Fire size class"
      note="A is the smallest class."
      table={<table className="w-full"><tbody>{rows.map((r) => (<tr key={r.k}><td>{r.k}</td><td className="text-right tabular-nums">{r.n.toLocaleString()}</td></tr>))}</tbody></table>}
    >
      <Status loading={g.loading} empty={!rows.length} />
      {rows.length > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Number of fires by size class">
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={L} x2={W - 6} y1={T + ih * (1 - t)} y2={T + ih * (1 - t)} stroke="var(--line)" />
              <text x={L - 4} y={T + ih * (1 - t) + 3} textAnchor="end" fontSize={9} style={muted}>{fmtN(max * t)}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const h = (r.n / max) * ih;
            return (
              <g key={r.k}>
                <rect x={L + i * bw + 3} y={T + ih - h} width={Math.max(bw - 6, 2)} height={Math.max(h, 0.5)} rx={2} fill="var(--accent)">
                  <title>{`Class ${r.k}: ${r.n.toLocaleString()}`}</title>
                </rect>
                <text x={L + i * bw + bw / 2} y={H - 5} textAnchor="middle" fontSize={10} style={ink}>{r.k}</text>
              </g>
            );
          })}
        </svg>
      )}
    </Card>
  );
}

export default function ChartsPanel() {
  const fm = useStore((s) => s.meta!.fieldMap);
  const dim = useChartDim();
  const chartExtent = useStore((s) => s.chartExtent);
  const exact = useStore((s) => s.parquet.status === "ready");
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={chartExtent || !exact} disabled={!exact} onChange={(e) => useStore.setState({ chartExtent: e.target.checked })} />
        Limit to current map extent
      </label>
      <p className="text-xs text-muted">
        {exact ? "Exact counts from Parquet." : "Approximate: counted from features rendered in the current view (limited to loaded tiles; low zooms are sampled)."}
      </p>
      {fm.year && fm[dim] && <YearStack dim={dim} />}
      {fm.doy && fm[dim] && <MonthHeat dim={dim} />}
      {fm[dim] && <Ranking dim={dim} />}
      {fm.sizeClass && <SizeClasses />}
    </div>
  );
}
