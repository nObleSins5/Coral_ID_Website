"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTankScene } from "@/app/tank/scene-actions";

// Same "one-shot setup form" shape as ConfigureGridForm — shown when a tank
// has no scene yet. Dimensions are entered in inches (how a hobbyist actually
// thinks about tank size) and converted to the canonical mm the rest of the
// scene model stores (lib/scene.ts's inchesToMm).
export function CreateSceneForm({ tankId }: { tankId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createTankScene(formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <form className="card" action={handleSubmit}>
      <input type="hidden" name="tank_id" value={tankId} />
      <p className="muted" style={{ marginTop: 0 }}>
        Enter your tank&apos;s real width, height, and depth. This turns a
        photo of your tank into a scaled canvas you tap corals onto, instead
        of choosing a grid cell.
      </p>
      <div className="row">
        <div>
          <label htmlFor="width_in">Width (in)</label>
          <input id="width_in" name="width_in" type="number" min="1" step="0.1" required />
        </div>
        <div>
          <label htmlFor="height_in">Height (in)</label>
          <input id="height_in" name="height_in" type="number" min="1" step="0.1" required />
        </div>
        <div>
          <label htmlFor="depth_in">Depth (in)</label>
          <input id="depth_in" name="depth_in" type="number" min="1" step="0.1" required />
        </div>
      </div>
      <button type="submit" disabled={pending}>
        {pending ? "Setting up…" : "Set up scene"}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
