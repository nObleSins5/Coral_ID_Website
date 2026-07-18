"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTankPublic } from "@/app/tank/actions";

// Business-only control (the page only renders this for a business-tier
// owner — see app/tank/[id]/page.tsx) to publish/unpublish the read-only
// showcase at /showcase/[id].
export function TankPublishToggle({
  tankId,
  isPublic,
}: {
  tankId: string;
  isPublic: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    const formData = new FormData();
    formData.set("tank_id", tankId);
    formData.set("is_public", (!isPublic).toString());
    startTransition(async () => {
      const result = await setTankPublic(formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="card" style={{ marginBottom: "1.25rem" }}>
      <p style={{ marginTop: 0, marginBottom: "0.4rem", fontWeight: 600 }}>Public showcase</p>
      {isPublic ? (
        <>
          <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
            Live at <a href={`/showcase/${tankId}`}>/showcase/{tankId}</a> — anyone with the
            link can view this grid, with each coral linked to its real wiki page.
          </p>
          <button type="button" className="btn-secondary" disabled={pending} onClick={toggle}>
            {pending ? "Unpublishing…" : "Unpublish"}
          </button>
        </>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
            Publish a read-only showcase of this tank for customers — the grid, each coral
            linked to its wiki page and recommended parameters.
          </p>
          <button type="button" disabled={pending} onClick={toggle}>
            {pending ? "Publishing…" : "Publish showcase"}
          </button>
        </>
      )}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
