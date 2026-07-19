"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateGridSlot } from "@/app/tank/actions";
import { placeSpecimen, removeFromSlot, updateSpecimen } from "@/app/specimen/actions";
import { getPhotosForTaxonAction } from "@/app/coral/actions";
import { QuickAddSpecimen } from "@/components/quick-add-specimen";
import { PhotoPicker, type PickablePhoto } from "@/components/photo-picker";
import { createClient } from "@/lib/supabase/client";
import type { SearchableMorph } from "@/lib/wiki";

type Genus = { id: string; name: string };

export type SlotInfo = {
  id: string;
  label: string;
  slotTypeCode: string | null;
  disabled: boolean;
};

export type Occupant = {
  specimenId: string;
  name: string | null;
  taxonName: string | null;
};

export type UnplacedOption = {
  specimenId: string;
  label: string; // nickname or taxon name, whichever a listing would show
  taxonId: string | null;
  taxonName: string | null;
  representativePhotoId: string | null;
};

const SLOT_TYPES: { code: string; label: string }[] = [
  { code: "sand", label: "Sand" },
  { code: "rock", label: "Rock" },
  { code: "open_water", label: "Open water" },
  { code: "frag_rack", label: "Frag rack" },
];

// The "place an unplaced coral into THIS slot" half of the add-coral step —
// inverse of PlaceSpecimenControl (components/place-specimen-control.tsx,
// which picks a slot for a fixed specimen); here the slot is fixed and the
// specimen is chosen. Surfaces the specimen's existing photo by default and
// offers "use a community photo" instead, per the same PhotoPicker pattern
// AddSpecimenForm uses (components/add-specimen-form.tsx).
function PlaceExistingControl({
  slotId,
  unplaced,
  onDone,
}: {
  slotId: string;
  unplaced: UnplacedOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [specimenId, setSpecimenId] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PickablePhoto[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = unplaced.find((u) => u.specimenId === specimenId) ?? null;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  function selectSpecimen(id: string) {
    setSpecimenId(id);
    const option = unplaced.find((u) => u.specimenId === id) ?? null;
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
      setError("Choose a coral to place here.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const placeForm = new FormData();
      placeForm.set("specimen_id", specimenId);
      placeForm.set("grid_slot_id", slotId);
      const placeResult = await placeSpecimen(placeForm);
      if (placeResult?.error) {
        setError(placeResult.error);
        return;
      }
      if (selected && selectedId !== selected.representativePhotoId) {
        const photoForm = new FormData();
        photoForm.set("specimen_id", specimenId);
        photoForm.set("representative_photo_id", selectedId ?? "");
        const photoResult = await updateSpecimen(photoForm);
        if (photoResult?.error) {
          setError(photoResult.error);
          return;
        }
      }
      onDone();
      router.refresh();
    });
  }

  if (unplaced.length === 0) {
    return <p className="muted">Every coral in this tank is already placed.</p>;
  }

  return (
    <div>
      <label htmlFor="grid-panel-existing">Coral</label>
      <select
        id="grid-panel-existing"
        value={specimenId}
        onChange={(e) => selectSpecimen(e.target.value)}
      >
        <option value="" disabled>
          Choose an unplaced coral
        </option>
        {unplaced.map((u) => (
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
          {pending ? "Placing…" : "Place here"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

export function GridSlotPanel({
  slot,
  tankId,
  occupant,
  unplaced,
  isTopTier,
  morphs,
  genera,
  onClose,
}: {
  slot: SlotInfo;
  tankId: string;
  occupant: Occupant | null;
  unplaced: UnplacedOption[];
  isTopTier: boolean;
  morphs: SearchableMorph[];
  genera: Genus[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [slotType, setSlotType] = useState(slot.slotTypeCode ?? "");
  const [disabled, setDisabled] = useState(slot.disabled);
  const [confirmingCascade, setConfirmingCascade] = useState(false);
  const [cascade, setCascade] = useState(true);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [slotPending, startSlotTransition] = useTransition();
  const [addMode, setAddMode] = useState<"none" | "existing" | "new">("none");
  const [removePending, startRemoveTransition] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);

  const slotTypeChanged = slotType !== (slot.slotTypeCode ?? "") || disabled !== slot.disabled;

  function saveSlot(withCascade: boolean) {
    setSlotError(null);
    startSlotTransition(async () => {
      const formData = new FormData();
      formData.set("grid_slot_id", slot.id);
      formData.set("slot_type_code", slotType);
      formData.set("disabled", disabled.toString());
      formData.set("cascade_open_water", withCascade.toString());
      const result = await updateGridSlot(formData);
      if (result?.error) setSlotError(result.error);
      else {
        setConfirmingCascade(false);
        router.refresh();
      }
    });
  }

  function handleSaveSlot() {
    if (slotType === "open_water" && !isTopTier) {
      setConfirmingCascade(true);
      return;
    }
    saveSlot(true);
  }

  function handleRemove() {
    if (!occupant) return;
    setRemoveError(null);
    startRemoveTransition(async () => {
      const formData = new FormData();
      formData.set("specimen_id", occupant.specimenId);
      const result = await removeFromSlot(formData);
      if (result?.error) setRemoveError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="card grid-slot-panel">
      <div className="grid-slot-panel-header">
        <p style={{ margin: 0, fontWeight: 600 }}>{slot.label}</p>
        <button type="button" className="btn-secondary" onClick={onClose} style={{ marginTop: 0 }}>
          Close
        </button>
      </div>

      <label>Slot type</label>
      <div className="grid-slot-type-options">
        <label className="checkbox-label">
          <input
            type="radio"
            name="grid-slot-type"
            checked={slotType === ""}
            onChange={() => setSlotType("")}
          />
          Unset
        </label>
        {SLOT_TYPES.map((t) => (
          <label className="checkbox-label" key={t.code}>
            <input
              type="radio"
              name="grid-slot-type"
              checked={slotType === t.code}
              onChange={() => setSlotType(t.code)}
            />
            {t.label}
          </label>
        ))}
      </div>
      <label className="checkbox-label" style={{ marginTop: "0.5rem" }}>
        <input
          type="checkbox"
          checked={disabled}
          onChange={(e) => setDisabled(e.target.checked)}
        />
        Not usable for coral
      </label>

      {confirmingCascade ? (
        <div className="grid-slot-cascade-confirm">
          <p style={{ marginTop: 0 }}>
            This will also mark {slot.label}&apos;s tiers above this one as open water — coral
            can&apos;t be placed there afterward.
          </p>
          <label className="checkbox-label">
            <input type="checkbox" checked={cascade} onChange={(e) => setCascade(e.target.checked)} />
            Apply to the tiers above too
          </label>
          <div className="form-actions">
            <button type="button" disabled={slotPending} onClick={() => saveSlot(cascade)}>
              {slotPending ? "Saving…" : "Confirm"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirmingCascade(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="form-actions">
          <button type="button" disabled={slotPending || !slotTypeChanged} onClick={handleSaveSlot}>
            {slotPending ? "Saving…" : "Save slot settings"}
          </button>
        </div>
      )}
      {slotError ? <p className="error">{slotError}</p> : null}

      {occupant ? (
        <div className="grid-slot-occupant">
          <p style={{ marginBottom: "0.3rem" }}>
            <strong>{occupant.name || occupant.taxonName || "Unnamed coral"}</strong>
            {occupant.name && occupant.taxonName ? (
              <span className="muted"> · {occupant.taxonName}</span>
            ) : null}
          </p>
          <button type="button" className="btn-secondary" disabled={removePending} onClick={handleRemove}>
            {removePending ? "Removing…" : "Remove from slot"}
          </button>
          {removeError ? <p className="error">{removeError}</p> : null}
        </div>
      ) : disabled ? null : (
        <div className="grid-slot-add-coral">
          <p style={{ marginBottom: "0.4rem", fontWeight: 600 }}>Add a coral here</p>
          {addMode === "none" ? (
            <div className="form-actions" style={{ marginTop: 0 }}>
              <button type="button" onClick={() => setAddMode("existing")}>
                Place an unplaced coral
              </button>
              <button type="button" className="btn-secondary" onClick={() => setAddMode("new")}>
                Quick add new
              </button>
            </div>
          ) : addMode === "existing" ? (
            <PlaceExistingControl slotId={slot.id} unplaced={unplaced} onDone={() => setAddMode("none")} />
          ) : (
            <QuickAddSpecimen
              tankId={tankId}
              emptySlots={[]}
              morphs={morphs}
              genera={genera}
              presetSlotId={slot.id}
              onDone={() => {
                setAddMode("none");
                onClose();
              }}
              onCancel={() => setAddMode("none")}
            />
          )}
        </div>
      )}
    </div>
  );
}
