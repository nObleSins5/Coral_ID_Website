"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { placeSpecimen } from "@/app/specimen/actions";

type Slot = { id: string; label: string };

// A slot-picker + submit button for placing (or moving) a specimen. Moving
// to a new slot is a single UPDATE of grid_slot_id server-side, so the
// specimen's old slot (if any) is vacated automatically.
export function PlaceSpecimenControl({
  specimenId,
  emptySlots,
  actionLabel = "Place",
}: {
  specimenId: string;
  emptySlots: Slot[];
  actionLabel?: string;
}) {
  const router = useRouter();
  const [slotId, setSlotId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (emptySlots.length === 0) {
    return <p className="muted" style={{ fontSize: "0.85rem" }}>No empty slots.</p>;
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await placeSpecimen(formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <form
      className="place-specimen-form"
      action={handleSubmit}
      style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}
    >
      <input type="hidden" name="specimen_id" value={specimenId} />
      <select
        name="grid_slot_id"
        value={slotId}
        onChange={(e) => setSlotId(e.target.value)}
        required
      >
        <option value="" disabled>
          Choose a slot
        </option>
        {emptySlots.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending || !slotId}>
        {pending ? "…" : actionLabel}
      </button>
      {error ? <span className="error">{error}</span> : null}
    </form>
  );
}
