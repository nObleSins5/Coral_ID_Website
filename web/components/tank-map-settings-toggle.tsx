"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMapEnabled } from "@/app/tank/map-actions";

// Opt-in toggle for the photo-tile map, same pattern/placement as
// TankBadgeToggle (components/tank-badge-toggle.tsx) — grid_columns/
// grid_rows stay untouched either way, this only ever adds the enrichment
// layer on top (see 36_tank_map.sql).
export function TankMapSettingsToggle({
  tankId,
  mapEnabled,
}: {
  tankId: string;
  mapEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    const formData = new FormData();
    formData.set("tank_id", tankId);
    formData.set("map_enabled", (!mapEnabled).toString());
    startTransition(async () => {
      const result = await setMapEnabled(formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="card" style={{ marginBottom: "1.25rem" }}>
      <p style={{ marginTop: 0, marginBottom: "0.4rem", fontWeight: 600 }}>Photo-tile map</p>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
        {mapEnabled
          ? "Assemble your own section photos into a rough map and tag corals to precise spots on it."
          : "An opt-in enrichment on top of your grid — upload section photos, arrange them into a rough collage, and pin corals to exact spots."}
      </p>
      <button type="button" className={mapEnabled ? "btn-secondary" : undefined} disabled={pending} onClick={toggle}>
        {pending ? "Saving…" : mapEnabled ? "Disable photo-tile map" : "Enable photo-tile map"}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
