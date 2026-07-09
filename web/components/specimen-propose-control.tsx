"use client";

import { useState } from "react";
import { ProposeIdentificationForm } from "@/components/propose-identification-form";
import type { SearchableMorph } from "@/lib/wiki";

type Genus = { id: string; name: string };

// The "separate, higher-friction action" for a local/unidentified specimen:
// send its existing photo into the community pipeline without re-uploading.
// proposeIdentification (app/identify/actions.ts) flips the photo public.
export function SpecimenProposeControl({
  photoId,
  morphs,
  genera,
}: {
  photoId: string;
  morphs: SearchableMorph[];
  genera: Genus[];
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
      morphs={morphs}
      genera={genera}
      onDone={() => setOpen(false)}
    />
  );
}
