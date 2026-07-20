"use client";

import { useState } from "react";
import { ProposeIdentificationForm } from "@/components/propose-identification-form";
import type { CategoryOption, GenusOption, SearchableMorph } from "@/lib/wiki";

// The "separate, higher-friction action" for a local/unidentified specimen:
// send its existing photo into the community pipeline without re-uploading.
// proposeIdentification (app/identify/actions.ts) flips the photo public.
export function SpecimenProposeControl({
  photoId,
  photoUrl,
  morphs,
  categories,
  genusOptions,
}: {
  photoId: string;
  photoUrl: string;
  morphs: SearchableMorph[];
  categories: CategoryOption[];
  genusOptions: GenusOption[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        Propose an ID for this photo
      </button>
    );
  }

  return (
    <ProposeIdentificationForm
      photoId={photoId}
      photoUrl={photoUrl}
      morphs={morphs}
      categories={categories}
      genusOptions={genusOptions}
      onDone={() => setOpen(false)}
    />
  );
}
