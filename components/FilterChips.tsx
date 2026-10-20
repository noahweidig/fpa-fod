"use client";

import { X } from "lucide-react";
import { useStore } from "@/lib/store";
import { CAT_DIMS, DIM_LABEL, OTHER } from "@/lib/types";

interface Chip {
  key: string;
  text: string;
  clear: () => void;
}

const summarize = (vals: string[]) => (vals.length <= 2 ? vals.join(", ") : `${vals.length} selected`);
const range = (r: [number, number], unit = "") => `${r[0].toLocaleString()}–${r[1].toLocaleString()}${unit}`;

/** One removable chip per active filter, shown above the tabs. */
export default function FilterChips() {
  const filters = useStore((s) => s.filters);
  const legend = useStore((s) => s.legend);
  const area = useStore((s) => s.area);
  const areaLabel = useStore((s) => s.areaLabel);
  const patch = useStore((s) => s.patchFilters);

  const chips: Chip[] = [];
  if (filters.year) chips.push({ key: "year", text: `Year ${range(filters.year)}`, clear: () => patch({ year: null }) });
  if (filters.doy) chips.push({ key: "doy", text: `Day ${range(filters.doy)}`, clear: () => patch({ doy: null }) });
  if (filters.acres) chips.push({ key: "acres", text: `Acres ${range(filters.acres)}`, clear: () => patch({ acres: null }) });
  for (const d of CAT_DIMS) {
    const vals = filters.cats[d];
    if (!vals?.length) continue;
    chips.push({
      key: d,
      text: `${DIM_LABEL[d]}: ${summarize(vals)}`,
      clear: () => useStore.setState((s) => ({ filters: { ...s.filters, cats: { ...s.filters.cats, [d]: undefined } } })),
    });
  }
  if (filters.mtbs) chips.push({ key: "mtbs", text: "MTBS linked", clear: () => patch({ mtbs: null }) });
  if (filters.incident?.length) chips.push({ key: "incident", text: filters.incident.length === 1 ? `Incident: ${filters.incident[0].replace(/^\d{4}_[^_]*_/, "")}` : `${filters.incident.length} incidents`, clear: () => patch({ incident: null }) });
  if (area) chips.push({ key: "area", text: areaLabel ?? "Selected area", clear: () => useStore.setState({ area: null, areaLabel: null }) });
  if (legend.isolate) chips.push({ key: "iso", text: `Only: ${legend.isolate === OTHER ? "Other / missing" : legend.isolate}`, clear: () => useStore.setState({ legend: { isolate: null, hidden: [] } }) });
  if (legend.hidden.length) chips.push({ key: "hid", text: `${legend.hidden.length} hidden`, clear: () => useStore.setState({ legend: { isolate: null, hidden: [] } }) });

  if (!chips.length) return null;
  return (
    <ul className="flex max-h-20 flex-wrap gap-1 overflow-y-auto border-b border-line px-4 py-2" aria-label="Active filters">
      {chips.map((c) => (
        <li key={c.key}>
          <button
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-panel px-2 py-0.5 text-xs hover:border-muted"
            onClick={c.clear} title={`Remove: ${c.text}`} aria-label={`Remove filter ${c.text}`}
          >
            <span className="truncate">{c.text}</span>
            <X size={12} aria-hidden className="shrink-0 text-muted" />
          </button>
        </li>
      ))}
    </ul>
  );
}
