"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetGrid } from "@/app/tank/actions";

// Destructive — unplaces every specimen in the tank and deletes the grid
// layout. In-system confirmation (not window.confirm — a native dialog was
// the one moment this page broke out of its own visual system for the one
// truly destructive action on it) since there's no undo.
export function ResetGridButton({ tankId }: { tankId: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    const formData = new FormData();
    formData.set("tank_id", tankId);
    startTransition(async () => {
      await resetGrid(formData);
      setArmed(false);
      router.refresh();
    });
  }

  if (!armed) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setArmed(true)}>
        Reset grid
      </button>
    );
  }

  return (
    <div className="card reset-grid-confirm">
      <p style={{ marginTop: 0 }}>
        Reset this tank&apos;s grid? Every coral will be moved out of its slot
        and back into the &quot;Not yet in the grid&quot; list, and the
        current layout will be deleted so you can set it up again. This
        can&apos;t be undone — you may want to screenshot the grid first.
      </p>
      <div className="form-actions">
        <button type="button" className="btn-danger" onClick={handleConfirm} disabled={pending}>
          {pending ? "Resetting…" : "Yes, reset grid"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setArmed(false)}
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
