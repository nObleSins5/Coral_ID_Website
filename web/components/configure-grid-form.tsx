"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { configureGrid } from "@/app/tank/actions";

export function ConfigureGridForm({ tankId }: { tankId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await configureGrid(formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <form className="card" action={handleSubmit}>
      <input type="hidden" name="tank_id" value={tankId} />
      <p className="muted" style={{ marginTop: 0 }}>
        This tank doesn&apos;t have a grid yet. Choose a layout — this can
        only be set once, so pick enough room to grow into.
      </p>
      <div className="row">
        <div>
          <label htmlFor="grid_columns">Columns</label>
          <input id="grid_columns" name="grid_columns" type="number" min="1" step="1" required />
        </div>
        <div>
          <label htmlFor="grid_rows">Rows</label>
          <input id="grid_rows" name="grid_rows" type="number" min="1" step="1" required />
        </div>
        <div>
          <label htmlFor="tier_count">Tiers (height)</label>
          <input id="tier_count" name="tier_count" type="number" min="1" step="1" defaultValue={1} />
        </div>
      </div>
      <button type="submit" disabled={pending}>
        {pending ? "Setting up…" : "Set up grid"}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
