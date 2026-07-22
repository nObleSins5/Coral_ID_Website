"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTank } from "@/app/dashboard/actions";

// Deletion is refused server-side (see deleteTank) when the tank still has
// corals in it, rather than silently orphaning or cascading them — the
// window.confirm is just the "are you sure" gate for the case where it's
// actually going to succeed.
export function DeleteTankButton({ tankId, tankName }: { tankId: string; tankName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm(`Delete "${tankName}"? This can't be undone.`)) return;
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("tank_id", tankId);
    deleteTank(formData).then((result) => {
      setPending(false);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        type="button"
        className="btn-secondary"
        style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
        disabled={pending}
        onClick={handleDelete}
      >
        Delete tank
      </button>
      {error ? (
        <p className="error" style={{ margin: "0.3rem 0 0", fontSize: "0.85rem" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
