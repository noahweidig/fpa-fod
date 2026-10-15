import { useMemo } from "react";
import { assignColors } from "./colors";
import { MONTHS, colorModeDim, type ColorCtx, type LegendCtx } from "./expressions";
import { MONTH_COLORS, seqRamp } from "./palette";
import { useStore } from "./store";
import { OTHER, type ColorMode } from "./types";

export interface LegendEntry {
  key: string;
  label: string;
  color: string;
}

export const rankOf = (counts: Record<string, number>, vals: string[]) =>
  [...vals].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b));

export function useColorModel() {
  const mode = useStore((s) => s.colorMode);
  const cats = useStore((s) => s.categories);
  const picks = useStore((s) => s.picks);
  const basemap = useStore((s) => s.basemap);
  const yb = useStore((s) => s.yearBounds);
  const fm = useStore((s) => s.meta?.fieldMap);

  return useMemo(() => {
    const dark = basemap !== "light";
    const dim = colorModeDim(mode);
    let colors = new Map<string, string>();
    let entries: LegendEntry[] = [];
    let order: string[] = [];

    if (mode === "general" || mode === "specific") {
      order = cats[mode];
      const p = picks[mode];
      colors = assignColors(order, p);
      entries = [...colors.entries()].map(([key, color]) => ({ key, label: key, color }));
      if (order.length > colors.size || mode === "specific") entries.push({ key: OTHER, label: "Other", color: "#8d8c86" });
    } else if (mode === "sizeClass") {
      order = [...cats.sizeClass].sort();
      const ramp = seqRamp(Math.max(order.length, 1), dark);
      order.forEach((v, i) => colors.set(v, ramp[i]));
      entries = order.map((key, i) => ({ key, label: key, color: ramp[i] }));
    } else if (mode === "month") {
      entries = MONTHS.map((label, i) => ({ key: String(i + 1), label, color: MONTH_COLORS[i] }));
      entries.forEach((e) => colors.set(e.key, e.color));
    }

    const legendCtx: LegendCtx = {
      dim,
      colored: mode === "general" || mode === "specific" ? [...colors.keys()] : [...colors.keys()],
    };
    const colorCtx: ColorCtx | null = fm
      ? { mode: mode as ColorMode, fm, colors, yearRange: yb ?? [1992, 2020], sizeClasses: order, dark }
      : null;
    return { mode, dim, colors, entries, order, legendCtx, colorCtx, dark, ramp: seqRamp(5, dark) };
  }, [mode, cats, picks, basemap, yb, fm]);
}
