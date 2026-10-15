"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  counts?: Record<string, number>;
  /** allow adding values that are not in `options` (e.g. counties not yet seen in loaded tiles) */
  allowCustom?: boolean;
  placeholder?: string;
}

const MAX_SHOWN = 150;

export default function MultiSelect({ label, options, selected, onChange, counts, allowCustom, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [open]);

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const all = [...new Set([...selected, ...options])];
    return all.filter((o) => !ql || o.toLowerCase().includes(ql));
  }, [q, options, selected]);

  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  const canAdd = allowCustom && q.trim() && !shown.some((o) => o.toLowerCase() === q.trim().toLowerCase());

  return (
    <div className="relative" ref={root}>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
        <span>{label}</span>
        {selected.length > 0 && (
          <button className="normal-case underline" onClick={() => onChange([])}>
            clear
          </button>
        )}
      </div>
      <button
        className="btn flex w-full items-center justify-between text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">
          {selected.length === 0 ? (placeholder ?? "All") : selected.length <= 2 ? selected.join(", ") : `${selected.length} selected`}
        </span>
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-line bg-panel shadow-lg">
          <input
            autoFocus
            className="w-full border-b border-line bg-transparent px-2 py-1.5 text-sm outline-none"
            placeholder={`Search ${label.toLowerCase()}…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canAdd) {
                toggle(q.trim());
                setQ("");
              }
            }}
          />
          <ul className="max-h-56 overflow-y-auto py-1" role="listbox" aria-multiselectable>
            {canAdd && (
              <li>
                <button className="w-full px-2 py-1 text-left text-sm hover:bg-line/50" onClick={() => (toggle(q.trim()), setQ(""))}>
                  Add “{q.trim()}”
                </button>
              </li>
            )}
            {shown.slice(0, MAX_SHOWN).map((o) => (
              <li key={o} role="option" aria-selected={selected.includes(o)}>
                <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm hover:bg-line/50">
                  <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} />
                  <span className="min-w-0 flex-1 truncate">{o}</span>
                  {counts?.[o] != null && <span className="text-xs tabular-nums text-muted">{counts[o].toLocaleString()}</span>}
                </label>
              </li>
            ))}
            {shown.length > MAX_SHOWN && <li className="px-2 py-1 text-xs text-muted">{shown.length - MAX_SHOWN} more: keep typing to narrow</li>}
            {shown.length === 0 && !canAdd && <li className="px-2 py-1 text-xs text-muted">No matches yet. Values are discovered as tiles load.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
