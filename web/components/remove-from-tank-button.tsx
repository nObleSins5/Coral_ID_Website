"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeFromSlot } from "@/app/specimen/actions";

// Unplaces a specimen (clears grid_slot_id) without deleting it — the
// specimen record and its history stay intact, it just no longer sits in
// any slot.
export function RemoveFromTankButton({ specimenId }: { specimenId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const formData = new FormData();
    formData.set("specimen_id", specimenId);
    startTransition(async () => {
      await removeFromSlot(formData);
      router.refresh();
    });
  }

  return (
    <button type="button" className="btn-secondary" onClick={handleClick} disabled={pending}>
      {pending ? "…" : "Remove from tank"}
    </button>
  );
}
