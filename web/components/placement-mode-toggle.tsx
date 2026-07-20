"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPlacementMode } from "@/app/tank/actions";

// A quiet switch between the two placement UIs a tank can show — same
// "coexist, opt-in" idea as TankBadgeToggle sits next to on the page.
// Switching never deletes data (see setPlacementMode) — this just changes
// which view renders.
export function PlacementModeToggle({
  tankId,
  placementMode,
}: {
  tankId: string;
  placementMode: "grid" | "scene";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function switchTo(mode: "grid" | "scene") {
    setError(null);
    const formData = new FormData();
    formData.set("tank_id", tankId);
    formData.set("placement_mode", mode);
    startTransition(async () => {
      const result = await setPlacementMode(formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <p className="muted placement-mode-toggle">
      {placementMode === "grid" ? (
        <button type="button" className="btn-secondary-link" disabled={pending} onClick={() => switchTo("scene")}>
          Try the scaled tank photo view (beta)
        </button>
      ) : (
        <button type="button" className="btn-secondary-link" disabled={pending} onClick={() => switchTo("grid")}>
          Switch back to grid view
        </button>
      )}
      {error ? <span className="error"> {error}</span> : null}
    </p>
  );
}
