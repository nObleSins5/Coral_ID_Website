"use client";

import { useState } from "react";
import { CalloutList } from "@/components/tank-status-block";
import type { TankCallout } from "@/lib/tank-callouts";

// The dashboard card's "N callouts" pill used to be a dead end — a plain
// span with no link, no explanation, nowhere to click. This makes it an
// actual disclosure: clicking it expands the same chip list /tank/[id]
// renders (CalloutList, tank-status-block.tsx) right here on the dashboard,
// so an owner doesn't have to open the tank just to see what's flagged.
export function CalloutSummaryToggle({
  callouts,
  husbandryHref,
}: {
  callouts: TankCallout[];
  husbandryHref: string;
}) {
  const [open, setOpen] = useState(false);

  if (callouts.length === 0) return null;

  return (
    <div style={{ flexShrink: 0 }}>
      <button type="button" className="pill callout-summary-toggle" onClick={() => setOpen((o) => !o)}>
        {callouts.length} callout{callouts.length === 1 ? "" : "s"}
      </button>
      {open ? (
        <div className="card callout-summary-card">
          <CalloutList callouts={callouts} husbandryHref={husbandryHref} />
        </div>
      ) : null}
    </div>
  );
}
