"use client";

import { useMemo, useState } from "react";
import { MONTHS } from "@/lib/expressions";
import { lerpColor, seqRamp } from "@/lib/palette";
import { useStore } from "@/lib/store";
import type { CatDim } from "@/lib/types";
import { useColorModel, useDimColors } from "@/lib/useColorModel";
import { useGroup } from "@/lib/useGroup";
import { Card, fmtN, muted, niceMax, Ranking, Status, Tooltip, W, type Tip } from "./chartKit";

const tipAt = (e: React.MouseEvent<SVGElement>, text: string): Tip => {
  const r = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top - 8, text };
};

/* ---------- fires by month ---------- */
function MonthTotals() {
  const g = useGroup(["month"]);
  const [tip, setTip] = useState<Tip | null>(null);
  const counts = useMemo(() => {
    const c = Array.from({ length: 12 }, () => 0);
    for (const r of g.rows ?? []) {
      const m = Number(r.keys[0]);
      if (m >= 1 && m <= 12) c[m - 1] += r.n;
    }
    return c;
  }, [g.rows]);
  const max = niceMax(Math.max(0, ...counts));
  const H = 130, L = 38, T = 8, B = 18, iw = W - L - 6, ih = H - T - B, bw = iw / 12;
  const empty = counts.every((n) => !n);
  return (
    <Card
      title="Fires by month"
      note="Month from day of year (approximate)."
      table={<table className="w-full"><tbody>{MONTHS.map((m, i) => (<tr key={m}><td>{m}</td><td className="text-right tabular-nums">{counts[i].toLocaleString()}</td></tr>))}</tbody></table>}
    >
      <Status loading={g.loading} empty={empty} />
      {!empty && (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Number of fires by month">
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={L} x2={W - 6} y1={T + ih * (1 - t)} y2={T + ih * (1 - t)} stroke="var(--line)" />
                <text x={L - 4} y={T + ih * (1 - t) + 3} textAnchor="end" fontSize={9} style={muted}>{fmtN(max * t)}</text>
              </g>
            ))}
            {counts.map((n, i) => {
              const h = (n / max) * ih;
              return (
                <g key={MONTHS[i]} onMouseMove={(e) => setTip(tipAt(e, `${MONTHS[i]}: ${n.toLocaleString()}`))} onMouseLeave={() => setTip(null)}>
                  <rect x={L + i * bw} y={T} width={bw} height={ih} fill="transparent" />
                  <rect x={L + i * bw + 2} y={T + ih - h} width={Math.max(bw - 4, 2)} height={Math.max(h, 0.5)} rx={2} fill="var(--accent)" />
                  <text x={L + i * bw + bw / 2} y={H - 5} textAnchor="middle" fontSize={9} style={muted}>{MONTHS[i][0]}</text>
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

/* ---------- human vs natural share of fires per year ---------- */
function CauseShare() {
  const g = useGroup(["year", "classification"], { ignoreYear: true });
  const { colors } = useDimColors("classification");
  const [tip, setTip] = useState<Tip | null>(null);
  const { years, share } = useMemo(() => {
    const tot = new Map<number, number>();
    const part = new Map<string, number>();
    for (const r of g.rows ?? []) {
      const y = Number(r.keys[0]);
      if (!y) continue;
      tot.set(y, (tot.get(y) ?? 0) + r.n);
      part.set(`${y}|${r.keys[1]}`, r.n);
    }
    const ys = [...tot.keys()].sort((a, b) => a - b);
    const pct = (k: string) => ys.map((y) => ((part.get(`${y}|${k}`) ?? 0) / tot.get(y)!) * 100);
    return { years: ys, share: { Human: pct("Human"), Natural: pct("Natural") } };
  }, [g.rows]);
  const H = 140, L = 34, R = 8, T = 8, B = 18, iw = W - L - R, ih = H - T - B;
  const x = (i: number) => L + (years.length > 1 ? (i / (years.length - 1)) * iw : iw / 2);
  const y = (p: number) => T + ih * (1 - p / 100);
  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <Card
      title="Human vs natural share by year"
      note="Percent of each year’s fires; the rest have a missing or undetermined cause."
      table={
        <table className="w-full">
          <tbody>
            {years.map((yr, i) => (<tr key={yr}><td>{yr}</td><td className="text-right tabular-nums">{share.Human[i].toFixed(0)}% human</td><td className="text-right tabular-nums">{share.Natural[i].toFixed(0)}% natural</td></tr>))}
          </tbody>
        </table>
      }
    >
      <Status loading={g.loading} empty={!years.length} />
      {years.length > 0 && (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Line chart of the human and natural share of fires per year">
            {[0, 50, 100].map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" />
                <text x={L - 4} y={y(t) + 3} textAnchor="end" fontSize={9} style={muted}>{t}%</text>
              </g>
            ))}
            {(["Human", "Natural"] as const).map((k) => (
              <path key={k} d={line(share[k])} fill="none" stroke={colors.get(k) ?? "var(--accent)"} strokeWidth={2} />
            ))}
            {years.map((yr, i) => (
              <g key={yr} onMouseMove={(e) => setTip(tipAt(e, `${yr}\nHuman: ${share.Human[i].toFixed(0)}%\nNatural: ${share.Natural[i].toFixed(0)}%`))} onMouseLeave={() => setTip(null)}>
                <rect x={x(i) - iw / years.length / 2} y={T} width={iw / years.length} height={ih} fill="transparent" />
                {(yr - years[0]) % 5 === 0 && <text x={x(i)} y={H - 5} textAnchor="middle" fontSize={9} style={muted}>{yr}</text>}
              </g>
            ))}
          </svg>
          <Tooltip tip={tip} />
          <div className="flex gap-3 text-xs">
            {(["Human", "Natural"] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="h-0.5 w-3" style={{ background: colors.get(k) ?? "var(--accent)" }} />{k}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------- year x month heatmap ---------- */
function YearMonthHeat() {
  const cm = useColorModel();
  const g = useGroup(["year", "month"]);
  const [tip, setTip] = useState<Tip | null>(null);
  const ramp = useMemo(() => seqRamp(2, false), []);
  const [lo, hi] = cm.dark ? ["#1f3556", "#9cc7ff"] : ramp;
  const { cells, years, max } = useMemo(() => {
    const cells = new Map<string, number>();
    const ys = new Set<number>();
    let mx = 0;
    for (const r of g.rows ?? []) {
      const yr = Number(r.keys[0]), mo = Number(r.keys[1]);
      if (!yr || !mo) continue;
      ys.add(yr);
      cells.set(`${yr}|${mo}`, r.n);
      mx = Math.max(mx, r.n);
    }
    return { cells, years: [...ys].sort((a, b) => a - b), max: mx };
  }, [g.rows]);
  const L = 34, T = 14, cw = (W - L - 4) / 12, ch = 8;
  const H = T + years.length * ch + 4;
  return (
    <Card title="Year × month" note="Darker = more fires. Month from day of year (approximate).">
      <Status loading={g.loading} empty={!years.length} />
      {years.length > 0 && (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Heatmap of fires by year and month">
            {MONTHS.map((m, i) => (
              <text key={m} x={L + i * cw + cw / 2} y={10} textAnchor="middle" fontSize={8.5} style={muted}>{m[0]}</text>
            ))}
            {years.map((yr, ri) => (
              <g key={yr}>
                {(yr - years[0]) % 5 === 0 && <text x={L - 4} y={T + ri * ch + 7} textAnchor="end" fontSize={8.5} style={muted}>{yr}</text>}
                {MONTHS.map((m, mi) => {
                  const v = cells.get(`${yr}|${mi + 1}`) ?? 0;
                  return (
                    <rect
                      key={m} x={L + mi * cw + 0.5} y={T + ri * ch + 0.5} width={cw - 1} height={ch - 1}
                      fill={v ? lerpColor(lo, hi, Math.sqrt(v / max)) : "var(--line)"}
                      opacity={v ? 1 : 0.4}
                      onMouseMove={(e) => setTip(tipAt(e, `${m} ${yr}: ${v.toLocaleString()}`))}
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

const RANKED: CatDim[] = ["state", "owner"];

export default function ExtraCharts({ dim }: Readonly<{ dim: CatDim }>) {
  const fm = useStore((s) => s.meta!.fieldMap);
  return (
    <>
      {fm.doy && <MonthTotals />}
      {fm.year && fm.classification && <CauseShare />}
      {fm.year && fm.doy && <YearMonthHeat />}
      {RANKED.filter((d) => d !== dim && fm[d]).map((d) => (
        <Ranking key={d} dim={d} />
      ))}
    </>
  );
}
