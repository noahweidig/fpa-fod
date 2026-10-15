import { useMemo } from "react";
import { assignColors } from "./colors";
import { MONTHS, colorModeDim, type ColorCtx, type LegendCtx } from "./expressions";
import { MONTH_COLORS, OTHER_COLOR, seqRamp } from "./palette";
import { useStore } from "./store";
import { OTHER, type CatDim } from "./types";

export interface LegendEntry {
  key: string;
  label: string;
  color: string;
}

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
    let ordinal = false;

    if (mode === "sizeClass") {
      ordinal = true;
      order = [...cats.values.sizeClass].sort();
      const ramp = seqRamp(Math.max(order.length, 1), dark);
      order.forEach((v, i) => colors.set(v, ramp[i]));
      entries = order.map((key, i) => ({ key, label: key, color: ramp[i] }));
    } else if (mode === "month") {
      entries = MONTHS.map((label, i) => ({ key: String(i + 1), label, color: MONTH_COLORS[i] }));
      entries.forEach((e) => colors.set(e.key, e.color));
    } else if (mode !== "year") {
      const d = mode as CatDim;
      order = cats.values[d];
      colors = assignColors(order, picks[d]);
      entries = [...colors.entries()].map(([key, color]) => ({ key, label: key, color }));
      entries.push({ key: OTHER, label: "Other / missing", color: OTHER_COLOR });
    }

    const legendCtx: LegendCtx = { dim, colored: [...colors.keys()] };
    const colorCtx: ColorCtx | null = fm ? { mode, fm, colors, yearRange: yb ?? [1992, 2020], dark } : null;
    return { mode, dim, colors, entries, order, ordinal, legendCtx, colorCtx, dark, ramp: seqRamp(5, dark) };
  }, [mode, cats, picks, basemap, yb, fm]);
}

/** Colors/entries for a categorical dimension, independent of the current color mode (used by charts). */
export function useDimColors(dim: CatDim) {
  const order = useStore((s) => s.categories.values[dim]);
  const picks = useStore((s) => s.picks[dim]);
  return useMemo(() => {
    const colors = assignColors(order, picks);
    const entries: LegendEntry[] = [...colors.entries()].map(([key, color]) => ({ key, label: key, color }));
    entries.push({ key: OTHER, label: "Other / missing", color: OTHER_COLOR });
    return { colors, entries };
  }, [order, picks]);
}
