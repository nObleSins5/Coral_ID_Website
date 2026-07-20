"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTankPhoto, uploadTankPhoto } from "@/app/tank/actions";

export type TankPhoto = {
  id: string;
  url: string;
  caption: string | null;
  uploader_user_id: string;
};

function UploadForm({ tankId }: { tankId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        + Add a tank photo
      </button>
    );
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("tank_id", tankId);
    startTransition(async () => {
      const result = await uploadTankPhoto(formData);
      if (result?.error) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <form className="add-photo-form" action={handleSubmit}>
      <label htmlFor="tank-photo">Photo</label>
      <input
        id="tank-photo"
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required
      />

      <label htmlFor="tank-photo-caption">Caption (optional)</label>
      <input id="tank-photo-caption" name="caption" maxLength={280} placeholder="e.g. Full tank shot, week 12" />

      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

function PhotoTile({
  photo,
  tankId,
  isOwner,
}: {
  photo: TankPhoto;
  tankId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Remove this photo?")) return;
    const formData = new FormData();
    formData.set("photo_id", photo.id);
    formData.set("tank_id", tankId);
    startTransition(async () => {
      await deleteTankPhoto(formData);
      router.refresh();
    });
  }

  return (
    <div className="photo-tile">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={photo.caption ?? "Tank photo"} />
      {photo.caption ? <p className="muted" style={{ fontSize: "0.8rem" }}>{photo.caption}</p> : null}
      {isOwner ? (
        <button type="button" className="btn-secondary" disabled={pending} onClick={handleDelete}>
          {pending ? "Removing…" : "Remove"}
        </button>
      ) : null}
    </div>
  );
}

// Whole-tank photo gallery — distinct from any per-coral photo grid
// elsewhere in the app (see sql/supabase/36_tank_photos.sql). Owner sees the
// upload form and a remove control on each tile; a public showcase visitor
// (app/showcase/[id]/page.tsx) sees the same tiles read-only via isOwner=false.
export function TankPhotoGallery({
  tankId,
  photos,
  isOwner,
}: {
  tankId: string;
  photos: TankPhoto[];
  isOwner: boolean;
}) {
  return (
    <div>
      {isOwner ? (
        <div style={{ marginBottom: "1rem" }}>
          <UploadForm tankId={tankId} />
        </div>
      ) : null}
      {photos.length === 0 ? (
        <p className="muted">
          {isOwner ? "No tank photos yet — add one above." : "No tank photos yet."}
        </p>
      ) : (
        <div className="photo-grid">
          {photos.map((p) => (
            <PhotoTile key={p.id} photo={p} tankId={tankId} isOwner={isOwner} />
          ))}
        </div>
      )}
    </div>
  );
}
