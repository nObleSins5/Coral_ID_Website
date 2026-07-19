"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { quickAddMorph } from "@/app/coral/actions";

// The fast on-ramp for "I know this genus, I don't see my morph" — sits in
// the very top row of a genus's wiki page, above the registry grid. Expands
// in place (no route change), matching the collapsed "+ Add a photo to
// identify" pattern already used in components/identify-queue.tsx. Submitting
// calls quickAddMorph (app/coral/actions.ts), which does the upload AND the
// new-morph proposal in one step — the result shows up immediately as a
// Pending tile in the grid below (see getPendingMorphsForGenus, lib/wiki.ts).
export function AddMorphCallout({
  genusId,
  genusName,
  genusSlug,
}: {
  genusId: string;
  genusName: string;
  genusSlug: string;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
    })();
  }, []);

  if (loading) return null;

  if (!open) {
    return (
      <div className="add-morph-callout">
        <p>
          Don&apos;t see the {genusName}{" "}
          morph you&apos;re looking for? Add it — takes 30 seconds.
        </p>
        {userId ? (
          <button type="button" onClick={() => setOpen(true)}>
            + Add a new morph
          </button>
        ) : (
          <span className="muted">
            <a href="/login">Log in</a> to add one.
          </span>
        )}
      </div>
    );
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("genus_id", genusId);
    formData.set("genus_slug", genusSlug);
    startTransition(async () => {
      const result = await quickAddMorph(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <form className="add-morph-form add-photo-form" action={handleSubmit}>
      <label htmlFor="new-morph-name">Morph name</label>
      <input id="new-morph-name" name="name" type="text" required maxLength={200} />

      <label htmlFor="new-morph-photo">Photo</label>
      <input
        id="new-morph-photo"
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required
      />

      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add morph"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
