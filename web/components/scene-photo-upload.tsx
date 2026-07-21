"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadImageDirect } from "@/lib/photo-upload-client";
import { attachSceneView } from "@/app/tank/scene-actions";
import type { Facing } from "@/lib/scene";

const FACING_LABEL: Record<Facing, string> = {
  front: "Face-on photo",
  side: "Side-profile photo",
  top: "Top-down photo (optional)",
};

// One facing's upload/replace control — the tank page renders one of these
// per facing (front + side required, top optional per
// docs/tank-scale-model-brief.md §3). Two steps, not one form submit:
// 1) uploadImageDirect puts the file straight into Supabase Storage from the
//    browser (converting HEIC/HEIF along the way) — see
//    lib/photo-upload-client.ts for why this can't be a plain Server Action
//    file upload. 2) attachSceneView, a lightweight server action, just
//    records the resulting URL. Replacing an existing photo clears its
//    calibration server-side, so the hint below warns before the user
//    overwrites a photo they already spent time marking up.
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const uploaded = await uploadImageDirect(file);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";

    if ("error" in uploaded) {
      setError(uploaded.error);
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("scene_id", sceneId);
      fd.set("facing", facing);
      fd.set("image_url", uploaded.publicUrl);
      const result = await attachSceneView(fd);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  const busy = uploading || isSaving;

  return (
    <div className="scene-photo-upload">
      <label htmlFor={`scene-photo-${facing}`}>{FACING_LABEL[facing]}</label>
      <input
        ref={inputRef}
        id={`scene-photo-${facing}`}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        disabled={busy}
        onChange={handleFileChange}
      />
      {busy ? <span className="muted">{uploading ? "Converting/uploading…" : "Saving…"}</span> : null}
      {hasExisting ? (
        <p className="muted scene-photo-upload-hint">
          Replacing clears this photo&apos;s calibration — you&apos;ll need to re-mark it.
        </p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
