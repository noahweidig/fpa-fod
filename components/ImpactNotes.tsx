"use client";

import { useEffect, useState } from "react";
import { ICS_CITATION } from "@/lib/config";
import { linkStats } from "@/lib/impact";

/** How the datasets are linked and what that means for the numbers. */
export default function ImpactNotes() {
  const [s, setS] = useState<Awaited<ReturnType<typeof linkStats>>>(null);
  useEffect(() => {
    linkStats().then(setS).catch(() => {});
  }, []);
  return (
    <details className="rounded-lg border border-line p-3 text-xs">
      <summary className="cursor-pointer text-sm font-semibold">How impact is linked and counted</summary>
      <div className="mt-2 space-y-2 text-muted">
        {s && (
          <p>
            {s.incidents.toLocaleString()} ICS-209-PLUS wildfire incidents ({s.years[0]}–{s.years[1]}); {s.withFod.toLocaleString()} link to FOD ignitions and {s.withMtbs.toLocaleString()} to MTBS perimeters.
            Fires after {s.years[1]} have no incident data.
          </p>
        )}
        <p>
          An <b>incident</b> reports the damage. FOD ignitions and MTBS perimeters only link to it. One incident can cover several ignitions and several perimeters, and
          a few ignitions or perimeters appear under more than one incident, so impact is never summed over ignitions or perimeters.
        </p>
        <p>
          A <b>complex</b> and its member fires are separate incidents that both report damage, and members often report less than the complex (the Tubbs fire reports 576
          structures destroyed, its Central LNU complex 7,010). Totals and rankings count complexes once. Tick &quot;Include complex members&quot; to see members, with overlapping totals.
        </p>
        <p>Cost is nominal dollars and missing for about a third of incidents. Evacuation counts are mostly 2014 onward. Reporting before 2002 is sparse.</p>
        <p>{ICS_CITATION}</p>
      </div>
    </details>
  );
}
