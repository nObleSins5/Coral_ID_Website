"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadSceneView } from "@/app/tank/scene-actions";
import type { Facing } from "@/lib/scene";

const FACING_LABEL: Record<Facing, string> = {
  front: "Face-on photo",
  side: "Side-profile photo",
  top: "Top-down photo (optional)",
};

// One facing's upload/replace control — the tank page renders one of these
// per facing (front + side required, top optional per
// docs/tank-scale-model-brief.md §3). Replacing an existing photo clears its
// calibration server-side (uploadSceneView), so the hint below warns before
// the user overwrites a photo they already spent time marking up.
export function ScenePhotoUpload({
  sceneId,
  facing,
  hasExisting,
}: {
  sceneId: string;
  facing: Facing;
  hasExisting: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadSceneView(formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <form className="scene-photo-upload" action={handleSubmit}>
      <input type="hidden" name="scene_id" value={sceneId} />
      <input type="hidden" name="facing" value={facing} />
      <label htmlFor={`scene-photo-${facing}`}>{FACING_LABEL[facing]}</label>
      <input
        id={`scene-photo-${facing}`}
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required
      />
      <button type="submit" disabled={pending}>
        {pending ? "Uploading…" : hasExisting ? "Replace photo" : "Upload"}
      </button>
      {hasExisting ? (
        <p className="muted scene-photo-upload-hint">
          Replacing clears this photo&apos;s calibration — you&apos;ll need to re-mark it.
        </p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
