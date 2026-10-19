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
