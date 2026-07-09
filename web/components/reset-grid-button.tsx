"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetGrid } from "@/app/tank/actions";

// Destructive — unplaces every specimen in the tank and deletes the grid
// layout. Warns before doing anything, since there's no undo.
export function ResetGridButton({ tankId }: { tankId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmed = window.confirm(
      "Reset this tank's grid? Every specimen will be unplaced back into " +
        "the unplaced-specimens list, and the current layout will be " +
        "deleted so you can set it up again. This can't be undone — " +
        "you may want to screenshot the grid first.",
    );
    if (!confirmed) return;
    const formData = new FormData();
    formData.set("tank_id", tankId);
    startTransition(async () => {
      await resetGrid(formData);
      router.refresh();
    });
  }

  return (
    <button type="button" className="btn-secondary" onClick={handleClick} disabled={pending}>
      {pending ? "Resetting…" : "Reset grid"}
    </button>
  );
}
