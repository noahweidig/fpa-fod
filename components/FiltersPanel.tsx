"use client";

import { Calendar, Flame, MapPin, Ruler, Users } from "lucide-react";
import { useMemo } from "react";
import { MONTHS, MONTH_STARTS } from "@/lib/expressions";
import { useStore } from "@/lib/store";
import { DIM_LABEL, type CatDim } from "@/lib/types";
import Collapsible from "./Collapsible";
import AreaPanel from "./AreaPanel";
import MtbsPanel from "./MtbsPanel";
import MultiSelect from "./MultiSelect";
import RangeSlider from "./RangeSlider";

const monthStart = (m: number) => MONTH_STARTS[m];
const monthEnd = (m: number) => (m === 11 ? 366 : MONTH_STARTS[m + 1] - 1);
const monthOfDoy = (d: number) => MONTH_STARTS.filter((s) => d >= s).length - 1;
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const dayLabel = (d: number) => {
  const m = monthOfDoy(d);
  return `${MONTHS[m]} ${Math.min(d - MONTH_STARTS[m] + 1, DAYS[m])}`;
};
const round2 = (n: number) => Number(n.toPrecision(3));

const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString() : String(Number(n.toPrecision(3))));

function Label({ children, value }: { children: React.ReactNode; value?: string }) {
  return (
    <div className="mb-1 flex justify-between text-xs font-semibold uppercase tracking-wide text-muted">
      <span>{children}</span>
      {value && <span className="normal-case tabular-nums text-ink">{value}</span>}
    </div>
  );
}

/** log-scale slider position (0..1000) <-> acres */
function AcreFilter() {
  const b = useStore((s) => s.acreBounds);
  const acres = useStore((s) => s.filters.acres);
  const patch = useStore((s) => s.patchFilters);
  if (!b) return null;
  const lo = Math.max(b[0], 0.01), hi = Math.max(b[1], lo * 10);
  const L = Math.log10(lo), H = Math.log10(hi);
  const toPos = (v: number) => Math.round(((Math.log10(Math.max(v, lo)) - L) / (H - L)) * 1000);
  const toVal = (p: number) => {
    const v = 10 ** (L + (p / 1000) * (H - L));
    return v >= 100 ? Math.round(v) : Number(v.toPrecision(3));
  };
  const cur: [number, number] = acres ?? [lo, hi];
  const set = (r: [number, number]) => patch({ acres: r[0] <= lo && r[1] >= hi ? null : r });
  return (
    <section>
      <Label value={`${fmt(cur[0])} – ${fmt(cur[1])} ac`}>Fire size (acres)</Label>
      <RangeSlider
        label="Acreage" min={0} max={1000} value={[toPos(cur[0]), toPos(cur[1])]}
        onChange={(p) => set([p[0] === 0 ? lo : toVal(p[0]), p[1] === 1000 ? hi : toVal(p[1])])}
      />
      <div className="mt-1 flex gap-2">
        {[0, 1].map((i) => (
          <input
            key={i} type="number" min={0} step="any" aria-label={i ? "Maximum acres" : "Minimum acres"}
            className="w-full rounded border border-line bg-transparent px-2 py-1 text-xs"
            value={round2(cur[i])}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) set(i ? [cur[0], Math.max(v, cur[0])] : [Math.min(v, cur[1]), cur[1]]);
            }}
          />
        ))}
      </div>
    </section>
  );
}

function CatFilter({ dim, options, allowCustom }: { dim: CatDim; options?: string[]; allowCustom?: boolean }) {
  const fm = useStore((s) => s.meta!.fieldMap);
  const all = useStore((s) => s.categories.values[dim]);
  const counts = useStore((s) => s.categories.counts[dim]);
  const sel = useStore((s) => s.filters.cats[dim]) ?? [];
  const setCats = (v: string[]) =>
    useStore.setState((s) => ({ filters: { ...s.filters, cats: { ...s.filters.cats, [dim]: v.length ? v : undefined } } }));
  if (!fm[dim]) return null;
  return (
    <MultiSelect label={DIM_LABEL[dim]} options={options ?? all} selected={sel} onChange={setCats} counts={counts} allowCustom={allowCustom} />
  );
}

export default function FiltersPanel() {
  const meta = useStore((s) => s.meta)!;
  const fm = meta.fieldMap;
  const yb = useStore((s) => s.yearBounds);
  const year = useStore((s) => s.filters.year);
  const doy = useStore((s) => s.filters.doy);
  const cls = useStore((s) => s.filters.cats.classification) ?? [];
  const pairs = useStore((s) => s.categories.pairs);
  const generalAll = useStore((s) => s.categories.values.general);
  const sizeClasses = useStore((s) => s.categories.values.sizeClass);
  const sizeSel = useStore((s) => s.filters.cats.sizeClass) ?? [];
  const patch = useStore((s) => s.patchFilters);
  const f = useStore((s) => s.filters);
  const nCats = (...dims: CatDim[]) => dims.filter((k) => f.cats[k]?.length).length;

  /* a classification selection narrows the general-cause list */
  const generalOptions = useMemo(() => {
    if (!cls.length || !Object.keys(pairs).length) return generalAll;
    return generalAll.filter((g) => !pairs[g] || pairs[g].some((c) => cls.includes(c)));
  }, [cls, pairs, generalAll]);

  const d: [number, number] = doy ?? [1, 366];
  const setDoy = (r: [number, number]) => patch({ doy: r[0] <= 1 && r[1] >= 366 ? null : r });

  return (
    <div className="space-y-3">
      <AreaPanel />
      <MtbsPanel />
      <Collapsible id="f-time" title="When" Icon={Calendar} badge={+!!f.year + +!!f.doy} defaultOpen>
      {fm.year && yb && (
        <section>
          <Label value={(year ?? yb).join(" – ")}>Year</Label>
          <RangeSlider
            label="Year range" min={yb[0]} max={yb[1]} value={year ?? yb}
            onChange={(v) => patch({ year: v[0] === yb[0] && v[1] === yb[1] ? null : v })}
          />
        </section>
      )}
      {fm.doy && (
        <section>
          <Label value={`${dayLabel(d[0])} – ${dayLabel(d[1])}`}>
            Day of year
          </Label>
          <RangeSlider label="Day of year" min={1} max={366} value={d} onChange={setDoy} />
          <div className="mt-1 flex gap-2">
            {[0, 1].map((i) => (
              <select
                key={i} aria-label={i ? "Last month" : "First month"}
                className="w-full rounded border border-line bg-panel px-2 py-1 text-xs"
                value={monthOfDoy(d[i])}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setDoy(i ? [d[0], Math.max(monthEnd(m), d[0])] : [Math.min(monthStart(m), d[1]), d[1]]);
                }}
              >
                {MONTHS.map((n, m) => (
                  <option key={n} value={m}>{n}</option>
                ))}
              </select>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted">Month is derived from day of year (approximate; ignores leap years).</p>
        </section>
      )}
      </Collapsible>
      <Collapsible id="f-cause" title="Cause" Icon={Flame} badge={nCats("classification", "general", "ageCat")} defaultOpen>
      <CatFilter dim="classification" />
      <CatFilter dim="general" options={generalOptions} />
      <CatFilter dim="ageCat" />
      </Collapsible>
      <Collapsible id="f-size" title="Size" Icon={Ruler} badge={nCats("sizeClass") + +!!f.acres}>
      {fm.sizeClass && (
        <section>
          <Label>Fire size class</Label>
          <div className="flex flex-wrap gap-1">
            {sizeClasses.map((c) => (
              <button
                key={c} className="btn min-w-8" aria-pressed={sizeSel.includes(c)}
                onClick={() =>
                  useStore.setState((s) => {
                    const next = sizeSel.includes(c) ? sizeSel.filter((x) => x !== c) : [...sizeSel, c];
                    return { filters: { ...s.filters, cats: { ...s.filters.cats, sizeClass: next.length ? next : undefined } } };
                  })
                }
              >
                {c}
              </button>
            ))}
          </div>
        </section>
      )}
      {fm.size && <AcreFilter />}
      </Collapsible>
      <Collapsible id="f-place" title="Where" Icon={MapPin} badge={nCats("state", "county")}>
      <CatFilter dim="state" />
      <CatFilter dim="county" allowCustom />
      </Collapsible>
      <Collapsible id="f-owner" title="Ownership and source" Icon={Users} badge={nCats("owner", "agency", "sourceType")}>
      <CatFilter dim="owner" />
      <CatFilter dim="agency" />
      <CatFilter dim="sourceType" />
      </Collapsible>
    </div>
  );
}
