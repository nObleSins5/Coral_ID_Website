"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSpecimen } from "@/app/specimen/actions";
import { PhotoPicker, type PickablePhoto } from "@/components/photo-picker";

export function EditSpecimenForm({
  specimenId,
  userId,
  initialName,
  initialAcquiredOn,
  initialRepresentativePhotoId,
  photos,
}: {
  specimenId: string;
  userId: string;
  initialName: string | null;
  initialAcquiredOn: string | null;
  initialRepresentativePhotoId: string | null;
  photos: PickablePhoto[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [photoId, setPhotoId] = useState<string | null>(initialRepresentativePhotoId);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    formData.set("representative_photo_id", photoId ?? "");
    startTransition(async () => {
      const result = await updateSpecimen(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <form className="add-photo-form" action={handleSubmit}>
      <input type="hidden" name="specimen_id" value={specimenId} />

      <label htmlFor="specimen_name">Nickname</label>
      <input id="specimen_name" name="name" defaultValue={initialName ?? ""} placeholder="e.g. Steve" />

      <label htmlFor="specimen_acquired_on">Acquired</label>
      <input
        id="specimen_acquired_on"
        name="acquired_on"
        type="date"
        defaultValue={initialAcquiredOn ?? ""}
      />

      <label>Representative photo</label>
      {photos.length === 0 ? (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          No photos exist for this coral yet.
        </p>
      ) : (
        <PhotoPicker photos={photos} userId={userId} selectedId={photoId} onSelect={setPhotoId} />
      )}

      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {saved && !error ? <p className="muted">Saved.</p> : null}
    </form>
  );
}
