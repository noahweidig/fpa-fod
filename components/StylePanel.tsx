"use client";

import { CATEGORICAL } from "@/lib/palette";
import { defaultPicks, nextFreeSlot } from "@/lib/colors";
import { useStore } from "@/lib/store";
import { useColorModel } from "@/lib/useColorModel";
import type { ColorMode } from "@/lib/types";

export const setColorMode = (m: ColorMode) =>
  useStore.setState({ colorMode: m, legend: { isolate: null, hidden: [] } });

function CausePicker({ mode }: { mode: "general" | "specific" }) {
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
  return (
    <details className="rounded border border-line">
      <summary className="cursor-pointer px-3 py-2 text-sm">
        Choose colored causes ({count}/{CATEGORICAL.length})
      </summary>
      <div className="max-h-56 overflow-y-auto border-t border-line p-2">
        {order.map((v) => {
          const on = v in eff;
          return (
            <label key={v} className="flex cursor-pointer items-center gap-2 py-0.5 text-xs">
              <input type="checkbox" checked={on} disabled={!on && count >= CATEGORICAL.length} onChange={() => toggle(v)} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? CATEGORICAL[eff[v] % CATEGORICAL.length] : "transparent", border: on ? "none" : "1px solid var(--line)" }} />
              <span className="truncate">{v}</span>
            </label>
          );
        })}
        <button className="btn mt-2 text-xs" onClick={() => useStore.setState((s) => ({ picks: { ...s.picks, [mode]: null } }))}>
          Reset to most frequent
        </button>
      </div>
    </details>
  );
}

export default function StylePanel() {
  const meta = useStore((s) => s.meta)!;
  const mode = useStore((s) => s.colorMode);
  const fm = meta.fieldMap;
  const modes: { id: ColorMode; label: string; ok: boolean }[] = [
    { id: "general", label: "General cause", ok: !!fm.general },
    { id: "specific", label: "Specific cause", ok: !!fm.specific },
  ];
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Color by</legend>
        <div className="flex flex-wrap gap-1">
          {modes.filter((m) => m.ok).map((m) => (
            <button key={m.id} className="btn" aria-pressed={mode === m.id} onClick={() => setColorMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>
      {(mode === "general" || mode === "specific") && <CausePicker mode={mode} />}
    </div>
  );
}
