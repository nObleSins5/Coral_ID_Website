"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { placeMapPin } from "@/app/tank/map-actions";
import { updateSpecimen } from "@/app/specimen/actions";
import { getPhotosForTaxonAction } from "@/app/coral/actions";
import { QuickAddSpecimen } from "@/components/quick-add-specimen";
import { PhotoPicker, type PickablePhoto } from "@/components/photo-picker";
import { createClient } from "@/lib/supabase/client";
import type { SearchableMorph } from "@/lib/wiki";

type Genus = { id: string; name: string };

// A specimen in this tank with no current map pin (uq_coral_map_pins_coral —
// one pin per coral, see 36_tank_map.sql) — the map's equivalent of
// grid-slot-panel.tsx's UnplacedOption, but keyed off "not yet pinned"
// rather than "not yet in the grid" since a coral can be in the grid AND
// unpinned, or pinned AND ungridded — the two systems are independent.
export type UnpinnedOption = {
  specimenId: string;
  label: string;
  taxonId: string | null;
  taxonName: string | null;
  representativePhotoId: string | null;
};

// The "pin an already-existing, unpinned coral onto THIS tile point" half of
// the add-coral step — direct analogue of grid-slot-panel.tsx's
// PlaceExistingControl, just targeting a tile+point instead of a grid slot.
function PlaceExistingPinControl({
  tileId,
  point,
  unpinned,
  onDone,
}: {
  tileId: string;
  point: { x: number; y: number };
  unpinned: UnpinnedOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [specimenId, setSpecimenId] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PickablePhoto[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = unpinned.find((u) => u.specimenId === specimenId) ?? null;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  function selectSpecimen(id: string) {
    setSpecimenId(id);
    const option = unpinned.find((u) => u.specimenId === id) ?? null;
    setSelectedId(option?.representativePhotoId ?? null);
    if (!option?.taxonId) {
      setPhotos(null);
      return;
    }
    setPhotos(null);
    getPhotosForTaxonAction(option.taxonId).then(setPhotos);
  }

  function submit() {
    if (!specimenId) {
      setError("Choose a coral to pin here.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const pinForm = new FormData();
      pinForm.set("coral_id", specimenId);
      pinForm.set("tile_id", tileId);
      pinForm.set("pos_x", String(point.x));
      pinForm.set("pos_y", String(point.y));
      const pinResult = await placeMapPin(pinForm);
      if (pinResult?.error) {
        setError(pinResult.error);
        return;
      }
      if (selected && selectedId !== selected.representativePhotoId) {
        const photoForm = new FormData();
        photoForm.set("specimen_id", specimenId);
        photoForm.set("representative_photo_id", selectedId ?? "");
        await updateSpecimen(photoForm);
      }
      onDone();
      router.refresh();
    });
  }

  if (unpinned.length === 0) {
    return <p className="muted">Every coral in this tank is already pinned to the map.</p>;
  }

  return (
    <div>
      <label htmlFor="map-panel-existing">Coral</label>
      <select
        id="map-panel-existing"
        value={specimenId}
        onChange={(e) => selectSpecimen(e.target.value)}
      >
        <option value="" disabled>
          Choose an unpinned coral
        </option>
        {unpinned.map((u) => (
          <option key={u.specimenId} value={u.specimenId}>
            {u.label}
          </option>
        ))}
      </select>

      {selected?.taxonId ? (
        <>
          <label>Photo</label>
          {photos === null ? (
            <p className="muted">Loading photos…</p>
          ) : photos.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              No community photos exist for this coral yet.
            </p>
          ) : userId ? (
            <PhotoPicker
              photos={photos}
              userId={userId}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : null}
        </>
      ) : null}

      <div className="form-actions">
        <button type="button" disabled={pending || !specimenId} onClick={submit}>
          {pending ? "Pinning…" : "Pin here"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

// Opens when a user clicks an empty point on a tile (see TankMapCanvas).
// Mirrors GridSlotPanel's "Add a coral here" — same two paths (place an
// already-existing coral vs. quick-add new), just targeting a tile+point
// instead of a grid slot. Per work-order feedback: the map must NOT invent
// its own add-coral flow, it reuses this exact one.
export function MapTilePanel({
  tileId,
  point,
  tankId,
  unpinned,
  morphs,
  genera,
  onClose,
}: {
  tileId: string;
  point: { x: number; y: number };
  tankId: string;
  unpinned: UnpinnedOption[];
  morphs: SearchableMorph[];
  genera: Genus[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [addMode, setAddMode] = useState<"none" | "existing" | "new">("none");
  const [pinPending, startPinTransition] = useTransition();
  const [pinError, setPinError] = useState<string | null>(null);

  function pinNewSpecimen(specimenId: string) {
    setPinError(null);
    startPinTransition(async () => {
      const pinForm = new FormData();
      pinForm.set("coral_id", specimenId);
      pinForm.set("tile_id", tileId);
      pinForm.set("pos_x", String(point.x));
      pinForm.set("pos_y", String(point.y));
      const result = await placeMapPin(pinForm);
      if (result?.error) setPinError(result.error);
    });
  }

  return (
    <div className="card map-tile-panel">
      <div className="grid-slot-panel-header">
        <p style={{ margin: 0, fontWeight: 600 }}>Add a coral here</p>
        <button type="button" className="btn-secondary" onClick={onClose} style={{ marginTop: 0 }}>
          Close
        </button>
      </div>

      {addMode === "none" ? (
        <div className="form-actions" style={{ marginTop: 0 }}>
          <button type="button" onClick={() => setAddMode("existing")}>
            Pin an unpinned coral
          </button>
          <button type="button" className="btn-secondary" onClick={() => setAddMode("new")}>
            Quick add new
          </button>
        </div>
      ) : addMode === "existing" ? (
        <PlaceExistingPinControl
          tileId={tileId}
          point={point}
          unpinned={unpinned}
          onDone={() => {
            setAddMode("none");
            onClose();
          }}
        />
      ) : (
        <>
          <QuickAddSpecimen
            tankId={tankId}
            emptySlots={[]}
            morphs={morphs}
            genera={genera}
            forceOpen
            onCreated={pinNewSpecimen}
            onDone={() => {
              setAddMode("none");
              onClose();
              router.refresh();
            }}
            onCancel={() => setAddMode("none")}
          />
          {pinPending ? <p className="muted">Pinning to the map…</p> : null}
          {pinError ? <p className="error">Coral was added, but pinning to the map failed: {pinError}</p> : null}
        </>
      )}
    </div>
  );
}
