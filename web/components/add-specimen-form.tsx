"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addSpecimen } from "@/app/coral/actions";
import { PhotoPicker, type PickablePhoto } from "@/components/photo-picker";

type Tank = { id: string; name: string };

export function AddSpecimenForm({
  taxonNodeId,
  taxonName,
  genusSlug,
  morphSlug,
  photos,
}: {
  taxonNodeId: string;
  taxonName: string;
  genusSlug: string;
  morphSlug: string;
  photos: PickablePhoto[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // undefined = no manual pick yet -> default to the user's own photo (below).
  // Once they click a tile (including "None", which is explicit null), that
  // choice sticks rather than being recomputed from an effect.
  const [manualPhotoId, setManualPhotoId] = useState<string | null | undefined>(
    undefined,
  );

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (user) {
        const { data } = await supabase
          .from("tanks")
          .select("id, name")
          .order("created_at", { ascending: true });
        setTanks(data ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const ownPhoto = useMemo(
    () => photos.find((p) => p.uploader_user_id === userId) ?? null,
    [photos, userId],
  );
  const selectedPhotoId =
    manualPhotoId !== undefined ? manualPhotoId : (ownPhoto?.id ?? null);

  if (loading) return null;

  if (!userId) {
    return (
      <p className="muted">
        <a href="/login">Log in</a> to add {taxonName} to your collection.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}>
        + Add to my collection
      </button>
    );
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("representative_photo_id", selectedPhotoId ?? "");
    startTransition(async () => {
      const result = await addSpecimen(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <form className="add-photo-form" action={handleSubmit}>
      <input type="hidden" name="taxon_node_id" value={taxonNodeId} />
      <input type="hidden" name="genus_slug" value={genusSlug} />
      <input type="hidden" name="morph_slug" value={morphSlug} />

      <label>Coral</label>
      <p style={{ margin: "0 0 0.5rem" }}>{taxonName}</p>

      <label htmlFor="specimen_tank_id">Tank</label>
      <select id="specimen_tank_id" name="tank_id" defaultValue="" required>
        <option value="" disabled>
          Choose a tank
        </option>
        {tanks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <label htmlFor="specimen_name">Nickname (optional)</label>
      <input id="specimen_name" name="name" placeholder="e.g. Steve" />

      <label htmlFor="specimen_acquired_on">Acquired (optional)</label>
      <input id="specimen_acquired_on" name="acquired_on" type="date" />

      <label>Representative photo (optional)</label>
      {!ownPhoto && (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          You don&apos;t have a photo of your own for this coral yet.{" "}
          <a href="#add-photo-section">Add one</a>, or pick from the community
          photos below.
        </p>
      )}
      {photos.length === 0 ? (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          No photos exist for this coral yet — you can still add it to your
          collection and attach a photo later.
        </p>
      ) : (
        <PhotoPicker
          photos={photos}
          userId={userId}
          selectedId={selectedPhotoId}
          onSelect={setManualPhotoId}
        />
      )}

      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add to collection"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
