// 13 categorical hues (one per NWCG general cause). First 11 validated with the dataviz palette
// validator (light surface: lightness band, chroma floor, adjacent CVD dE >= 8, adjacent normal-vision dE >= 15);
// last 2 not yet validated.
export const CATEGORICAL = [
  "#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300",
  "#6250d6", "#e34948", "#17becf", "#a0612a", "#a02a9c", "#84b000", "#1f3a8a",
];
export const OTHER_COLOR = "#8d8c86";
export const MONTH_COLORS = [
  "#1f3a8a", "#2a78d6", "#17becf", "#1baf7a", "#6aa51a", "#eda100",
  "#eb6834", "#e34948", "#a02a9c", "#7a4fb5", "#4b5dc7", "#2a4d9b",
];

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (v: number[]) => "#" + v.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");

export function lerpColor(a: string, b: string, t: number) {
  const x = hex(a), y = hex(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

/** Single-hue sequential ramp; `dark` flips lightness so later/larger stays most prominent on dark basemaps. */
export function seqRamp(n: number, dark: boolean): string[] {
  const [a, b] = dark ? ["#2a5da8", "#e6f1ff"] : ["#c4dbf7", "#0a3d91"];
  return Array.from({ length: n }, (_, i) => lerpColor(a, b, n === 1 ? 1 : i / (n - 1)));
}

export type RampId = "blue" | "viridis" | "plasma" | "magma" | "inferno" | "cividis" | "ylorrd" | "ylgnbu" | "greens" | "purples" | "oranges";

/** 5-class sequential ramps, low to high (viridis family from matplotlib, the rest from ColorBrewer). */
export const RAMPS: Record<RampId, { label: string; colors: string[] | null }> = {
  blue: { label: "Blue", colors: null },
  viridis: { label: "Viridis", colors: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"] },
  plasma: { label: "Plasma", colors: ["#0d0887", "#7e03a8", "#cc4778", "#f89540", "#f0f921"] },
  magma: { label: "Magma", colors: ["#000004", "#51127c", "#b73779", "#fc8961", "#fcfdbf"] },
  inferno: { label: "Inferno", colors: ["#000004", "#57106e", "#bc3754", "#f98e09", "#fcffa4"] },
  cividis: { label: "Cividis", colors: ["#00204d", "#414d6b", "#7c7b78", "#bcaf6f", "#ffea46"] },
  ylorrd: { label: "Yellow-orange-red", colors: ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"] },
  ylgnbu: { label: "Yellow-green-blue", colors: ["#ffffcc", "#a1dab4", "#41b6c4", "#2c7fb8", "#253494"] },
  greens: { label: "Greens", colors: ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"] },
  purples: { label: "Purples", colors: ["#f2f0f7", "#cbc9e2", "#9e9ac8", "#756bb1", "#54278f"] },
  oranges: { label: "Oranges", colors: ["#feedde", "#fdbe85", "#fd8d3c", "#e6550d", "#a63603"] },
};

export function rampColors(id: RampId, reverse: boolean, dark: boolean): string[] {
  const c = [...(RAMPS[id].colors ?? seqRamp(5, dark))];
  return reverse ? c.reverse() : c;
}
