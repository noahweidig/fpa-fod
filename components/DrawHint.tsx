"use client";

import { finishPoly, stopDraw, undoPoint } from "@/lib/areaLayer";
import { useStore } from "@/lib/store";

/** Instructions + finish/cancel while drawing a selection on the map. */
export default function DrawHint() {
  const mode = useStore((s) => s.drawMode);
  const n = useStore((s) => s.draft.length);
  if (!mode) return null;
  let text = "Double-click or Finish to close the shape.";
  if (mode === "circle") text = "Click the map to set the circle center.";
  else if (mode === "rect") text = "Drag on the map to draw a rectangle.";
  else if (n < 3) text = "Click to add corners (3 or more).";
  return (
    <div className="absolute bottom-28 left-1/2 z-20 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-xs shadow md:bottom-24" role="status">
      <span>{text}</span>
      {mode === "poly" && (
        <>
          <button className="btn text-xs" disabled={n < 3} onClick={finishPoly}>Finish</button>
          <button className="btn text-xs" disabled={n < 2} onClick={undoPoint}>Undo</button>
        </>
      )}
      <button className="btn text-xs" onClick={stopDraw}>Cancel</button>
    </div>
  );
}
