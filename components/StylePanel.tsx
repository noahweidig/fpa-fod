"use client";

import { defaultPicks, nextFreeSlot } from "@/lib/colors";
import { dimField } from "@/lib/expressions";
import { CATEGORICAL } from "@/lib/palette";
import ChoroplethPanel from "./ChoroplethPanel";
import { useStore } from "@/lib/store";
import { COLOR_MODES, DIM_LABEL, emptyPicks, type CatDim, type ColorMode, type RadiusMode } from "@/lib/types";
import { useColorModel } from "@/lib/useColorModel";

export const setColorMode = (m: ColorMode) => useStore.setState({ colorMode: m, legend: { isolate: null, hidden: [] } });

function CausePicker({ mode }: { mode: CatDim }) {
  const cm = useColorModel();
  const picks = useStore((s) => s.picks[mode]);
  const order = cm.order;
  const eff = picks ?? defaultPicks(order);
  const count = Object.keys(eff).length;
  const toggle = (v: string) => {
    const next = { ...eff };
    if (v in next) delete next[v];
    else {
      const slot = nextFreeSlot(next);
      if (slot < 0) return;
      next[v] = slot;
    }
    useStore.setState((s) => ({ picks: { ...s.picks, [mode]: next }, legend: { isolate: null, hidden: [] } }));
  };
  if (order.length <= CATEGORICAL.length) return null;
  return (
    <details className="rounded border border-line">
      <summary className="cursor-pointer px-3 py-2 text-sm">
        Choose colored values ({count}/{CATEGORICAL.length})
      </summary>
      <div className="max-h-56 overflow-y-auto border-t border-line p-2">
        {order.map((v) => {
          const on = v in eff;
          return (
            <label key={v} className="flex cursor-pointer items-center gap-2 py-0.5 text-xs">
              <input type="checkbox" checked={on} disabled={!on && count >= CATEGORICAL.length} onChange={() => toggle(v)} />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: on ? CATEGORICAL[eff[v] % CATEGORICAL.length] : "transparent", border: on ? "none" : "1px solid var(--line)" }}
              />
              <span className="truncate">{v}</span>
            </label>
          );
        })}
        <button
          className="btn mt-2 text-xs"
          onClick={() => useStore.setState((s) => ({ picks: { ...s.picks, [mode]: emptyPicks()[mode] } }))}
        >
          Reset to most frequent
        </button>
      </div>
    </details>
  );
}

export default function StylePanel() {
  const meta = useStore((s) => s.meta)!;
  const mode = useStore((s) => s.colorMode);
  const radiusMode = useStore((s) => s.radiusMode);
  const heat = useStore((s) => s.heat);
  const heatWeight = useStore((s) => s.heatWeight);
  const fm = meta.fieldMap;
  const modes = COLOR_MODES.filter((m) => dimField(m, fm));
  const radii: { id: RadiusMode; label: string; ok: boolean }[] = [
    { id: "fixed", label: "Fixed", ok: true },
    { id: "zoom", label: "Zoom-scaled", ok: true },
    { id: "size", label: "By fire size", ok: !!fm.size },
  ];
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Color by</legend>
        <div className="flex flex-wrap gap-1">
          {modes.map((m) => (
            <button key={m} className="btn" aria-pressed={mode === m} onClick={() => setColorMode(m)}>
              {DIM_LABEL[m]}
            </button>
          ))}
        </div>
      </fieldset>
      {mode !== "year" && mode !== "month" && mode !== "sizeClass" && <CausePicker mode={mode} />}
      <fieldset>
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Point radius</legend>
        <div className="flex flex-wrap gap-1">
          {radii.filter((r) => r.ok).map((r) => (
            <button key={r.id} className="btn" aria-pressed={radiusMode === r.id} onClick={() => useStore.setState({ radiusMode: r.id })}>
              {r.label}
            </button>
          ))}
        </div>
        {radiusMode === "size" && <p className="mt-1 text-xs text-muted">Radius ∝ √acres, capped.</p>}
      </fieldset>
      <ChoroplethPanel />
      <fieldset>
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Heatmap</legend>
        <div className="flex flex-wrap items-center gap-1">
          <button className="btn" aria-pressed={heat} onClick={() => useStore.setState({ heat: !heat })}>
            {heat ? "On" : "Off"}
          </button>
          {heat && (
            <>
              <button className="btn" aria-pressed={heatWeight === "count"} onClick={() => useStore.setState({ heatWeight: "count" })}>
                Weight: count
              </button>
              {fm.size && (
                <button className="btn" aria-pressed={heatWeight === "size"} onClick={() => useStore.setState({ heatWeight: "size" })}>
                  Weight: fire size
                </button>
              )}
            </>
          )}
        </div>
        {heat && <p className="mt-1 text-xs text-muted">Points appear from zoom 9; the heatmap fades out at zoom 11.</p>}
      </fieldset>
    </div>
  );
}
