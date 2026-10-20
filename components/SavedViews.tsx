"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { applyView, deleteView, loadViews, saveView, type SavedView } from "@/lib/views";

export default function SavedViews() {
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState("");
  useEffect(() => setViews(loadViews()), []);
  const save = () => {
    const n = name.trim();
    if (!n) return;
    setViews(saveView(n));
    setName("");
  };
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Saved views</legend>
      <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <input
          className="min-w-0 flex-1 rounded border border-line bg-panel px-2 py-1 text-sm" value={name} maxLength={60}
          onChange={(e) => setName(e.target.value)} placeholder="Name this view" aria-label="Saved view name"
        />
        <button className="btn" type="submit" disabled={!name.trim()}>Save</button>
      </form>
      <p className="mt-1 text-xs text-muted">Stores the map position, filters, colors and selected area in this browser only.</p>
      {views.length > 0 && (
        <ul className="mt-2 space-y-1">
          {views.map((v) => (
            <li key={v.name} className="flex items-center gap-1 text-sm">
              <button className="btn min-w-0 flex-1 truncate text-left" onClick={() => applyView(v)} title={`Saved ${new Date(v.at).toLocaleString()}`}>{v.name}</button>
              <button className="btn grid h-8 w-8 place-items-center p-0" onClick={() => setViews(deleteView(v.name))} aria-label={`Delete saved view ${v.name}`}>
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
