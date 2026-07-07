"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadCoralPhoto } from "@/app/coral/actions";

type Tank = { id: string; name: string };

export function AddPhotoForm({
  taxonNodeId,
  genusSlug,
  morphSlug,
}: {
  taxonNodeId: string;
  genusSlug: string;
  morphSlug: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  if (loading) return null;

  if (!userId) {
    return (
      <p className="muted">
        <a href="/login">Log in</a> to add a photo of this coral.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}>
        Add photo
      </button>
    );
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadCoralPhoto(formData);
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

      <label htmlFor="photo">Photo</label>
      <input
        id="photo"
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required
      />

      <label htmlFor="tank_id">Tank (optional — stamps your latest parameters)</label>
      <select id="tank_id" name="tank_id" defaultValue="">
        <option value="">No tank / standalone</option>
        {tanks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <label htmlFor="taken_at">Date taken</label>
      <input
        id="taken_at"
        name="taken_at"
        type="date"
        defaultValue={new Date().toISOString().slice(0, 10)}
      />

      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
