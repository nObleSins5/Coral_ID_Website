"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  quickAddExisting,
  quickAddLocal,
  quickAddUnidentified,
} from "@/app/tank/actions";
import { getPhotosForTaxonAction } from "@/app/coral/actions";
import { createClient } from "@/lib/supabase/client";
import type { SearchableMorph } from "@/lib/wiki";
import { PhotoPicker, type PickablePhoto } from "@/components/photo-picker";

type Genus = { id: string; name: string };
type Slot = { id: string; label: string };

// Shared bits every branch's form needs: an optional grid slot and an
// optional (or, for the "propose new" branch, required) photo. Skipped
// entirely when a slot is already fixed by context (presetSlotId, clicked
// from the grid itself — see grid-slot-panel.tsx).
function SlotPicker({ emptySlots }: { emptySlots: Slot[] }) {
  if (emptySlots.length === 0) return null;
  return (
    <>
      <label htmlFor="quick-add-slot">Place in slot (optional)</label>
      <select id="quick-add-slot" name="grid_slot_id" defaultValue="">
        <option value="">Don&apos;t place yet</option>
        {emptySlots.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </>
  );
}

// The matched-existing-coral branch's photo step: "Choose own photo" (any
// photo YOU already uploaded of this exact taxon, pick one — or upload a
// fresh one via the file input below the list) vs "Use a community photo"
// (someone else's public photo of this taxon). Photos are fetched once and
// split by ownership so each tab only ever shows what its label promises —
// previously every photo (including your own) landed under "community",
// which was the bug being fixed here.
function MatchedPhotoStep({ taxonId }: { taxonId: string }) {
  const [mode, setMode] = useState<"own" | "community">("own");
  const [userId, setUserId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PickablePhoto[] | null>(null);
  const [ownSelectedId, setOwnSelectedId] = useState<string | null>(null);
  const [communitySelectedId, setCommunitySelectedId] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    startTransition(async () => {
      const result = await getPhotosForTaxonAction(taxonId);
      setPhotos(result);
    });
  }, [taxonId]);

  const ownPhotos = (photos ?? []).filter((p) => p.uploader_user_id === userId);
  const communityPhotos = (photos ?? []).filter((p) => p.uploader_user_id !== userId);
  const representativePhotoId = mode === "own" ? ownSelectedId : communitySelectedId;

  return (
    <>
      <label>Photo (optional)</label>
      <div className="checkbox-row">
        <label className="checkbox-label">
          <input
            type="radio"
            name="quick-add-photo-mode"
            checked={mode === "own"}
            onChange={() => setMode("own")}
          />
          Choose own photo
        </label>
        <label className="checkbox-label">
          <input
            type="radio"
            name="quick-add-photo-mode"
            checked={mode === "community"}
            onChange={() => setMode("community")}
          />
          Use a community photo
        </label>
      </div>
      <input type="hidden" name="representative_photo_id" value={representativePhotoId ?? ""} />
      {loading ? <p className="muted">Loading photos…</p> : null}
      {mode === "own" ? (
        <>
          {ownPhotos.length > 0 && userId ? (
            <PhotoPicker
              photos={ownPhotos}
              userId={userId}
              selectedId={ownSelectedId}
              onSelect={setOwnSelectedId}
            />
          ) : null}
          {!ownSelectedId ? (
            <input
              id="quick-add-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            />
          ) : null}
        </>
      ) : (
        <>
          {communityPhotos.length === 0 && !loading ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              No community photos exist for this coral yet.
            </p>
          ) : null}
          {communityPhotos.length > 0 && userId ? (
            <PhotoPicker
              photos={communityPhotos}
              userId={userId}
              selectedId={communitySelectedId}
              onSelect={setCommunitySelectedId}
            />
          ) : null}
        </>
      )}
    </>
  );
}

// Inline search + quick-add for the tank grid page's "Not yet in the grid"
// section — add a coral (known, private-nickname, or propose-new) and
// optionally place it, all without navigating to the wiki and back.
export function QuickAddSpecimen({
  tankId,
  emptySlots,
  morphs,
  genera,
  presetSlotId,
  onDone,
  onCancel,
}: {
  tankId: string;
  emptySlots: Slot[];
  morphs: SearchableMorph[];
  genera: Genus[];
  // Set when opened from a specific grid cell (grid-slot-panel.tsx) — the
  // slot dropdown is skipped entirely and this slot is submitted directly.
  presetSlotId?: string;
  // Called (instead of the default collapse-back-to-button) after a
  // successful add, when this is embedded inside another panel that manages
  // its own open/closed state (grid-slot-panel.tsx).
  onDone?: () => void;
  // Called on Cancel when embedded (presetSlotId set) — signals the parent
  // panel to close/step back, since this component has no "collapsed" state
  // of its own in that context.
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!presetSlotId);
  const [query, setQuery] = useState("");
  const [matched, setMatched] = useState<SearchableMorph | null>(null);
  const [mode, setMode] = useState<"search" | "local" | "unidentified">("search");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const results = useMemo(() => {
    if (matched || mode !== "search" || query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return morphs
      .filter((m) => m.name.toLowerCase().includes(q) || m.genusName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, matched, mode, morphs]);

  function reset() {
    if (presetSlotId) {
      onCancel?.();
      return;
    }
    setOpen(false);
    setQuery("");
    setMatched(null);
    setMode("search");
    setError(null);
  }

  function succeed() {
    if (onDone) onDone();
    else reset();
    router.refresh();
  }

  function handleExisting(formData: FormData) {
    setError(null);
    formData.set("tank_id", tankId);
    formData.set("taxon_node_id", matched!.id);
    if (presetSlotId) formData.set("grid_slot_id", presetSlotId);
    startTransition(async () => {
      const result = await quickAddExisting(formData);
      if (result?.error) setError(result.error);
      else succeed();
    });
  }

  function handleLocal(formData: FormData) {
    setError(null);
    formData.set("tank_id", tankId);
    if (presetSlotId) formData.set("grid_slot_id", presetSlotId);
    startTransition(async () => {
      const result = await quickAddLocal(formData);
      if (result?.error) setError(result.error);
      else succeed();
    });
  }

  function handleUnidentified(formData: FormData) {
    setError(null);
    formData.set("tank_id", tankId);
    if (presetSlotId) formData.set("grid_slot_id", presetSlotId);
    startTransition(async () => {
      const result = await quickAddUnidentified(formData);
      if (result?.error) setError(result.error);
      else succeed();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}>
        + Add a coral
      </button>
    );
  }

  // A known coral, selected from search.
  if (matched) {
    return (
      <form className="add-photo-form card" action={handleExisting}>
        <label>Coral</label>
        <p style={{ margin: "0 0 0.5rem" }}>
          {matched.name} <span className="muted">({matched.genusName})</span>
        </p>
        <label htmlFor="quick-add-name">Nickname (optional)</label>
        <input id="quick-add-name" name="name" placeholder="e.g. Steve" />
        <MatchedPhotoStep taxonId={matched.id} />
        <label htmlFor="quick-add-taken-at">Date taken</label>
        <input
          id="quick-add-taken-at"
          name="taken_at"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
        {!presetSlotId ? <SlotPicker emptySlots={emptySlots} /> : null}
        <div className="form-actions">
          <button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </button>
          <button type="button" className="btn-secondary" onClick={reset}>
            Cancel
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </form>
    );
  }

  // "Just label this slot" — private, local-only.
  if (mode === "local") {
    return (
      <form className="add-photo-form card" action={handleLocal}>
        <div className="quick-add-notice quick-add-notice-private">
          <strong>Private</strong>
          Just for you — not shared with the wiki or community.
        </div>
        <label htmlFor="quick-add-local-name">Label</label>
        <input id="quick-add-local-name" name="name" defaultValue={query} required />
        <label htmlFor="quick-add-local-photo">Photo (optional)</label>
        <input
          id="quick-add-local-photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
        <label htmlFor="quick-add-local-taken-at">Date taken</label>
        <input
          id="quick-add-local-taken-at"
          name="taken_at"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
        {!presetSlotId ? <SlotPicker emptySlots={emptySlots} /> : null}
        <div className="form-actions">
          <button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </button>
          <button type="button" className="btn-secondary" onClick={reset}>
            Cancel
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </form>
    );
  }

  // "Propose as a new coral for the wiki" — public, kicks off /identify.
  if (mode === "unidentified") {
    return (
      <form className="add-photo-form card" action={handleUnidentified}>
        <div className="quick-add-notice quick-add-notice-public">
          <strong>Public</strong>
          This photo and name go to the wiki, where the community votes on the
          identification. Not reversible once submitted.
        </div>
        <label htmlFor="quick-add-new-name">Name</label>
        <input id="quick-add-new-name" name="name" defaultValue={query} required />
        <label htmlFor="quick-add-new-genus">Genus</label>
        <select id="quick-add-new-genus" name="genus_id" defaultValue="" required>
          <option value="" disabled>
            Choose a genus
          </option>
          {genera.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
          <option value="unsure">Not sure — genus unknown</option>
        </select>
        <label htmlFor="quick-add-new-photo">Photo (required)</label>
        <input
          id="quick-add-new-photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
        <label htmlFor="quick-add-new-taken-at">Date taken</label>
        <input
          id="quick-add-new-taken-at"
          name="taken_at"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
        {!presetSlotId ? <SlotPicker emptySlots={emptySlots} /> : null}
        <div className="form-actions">
          <button type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Submit"}
          </button>
          <button type="button" className="btn-secondary" onClick={reset}>
            Cancel
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </form>
    );
  }

  // Default: search.
  return (
    <div className="add-photo-form card">
      <label>Search the wiki</label>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. Walt Disney"
      />
      {results.length > 0 && (
        <div className="taxon-results">
          {results.map((m) => (
            <button
              type="button"
              key={m.id}
              className="taxon-result"
              onClick={() => setMatched(m)}
            >
              {m.name} <span className="muted">({m.genusName})</span>
            </button>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && (
        <p className="muted propose-switch">
          Not in the wiki?{" "}
          <button type="button" className="link-button" onClick={() => setMode("local")}>
            Just label this slot &quot;{query}&quot;
          </button>{" "}
          or{" "}
          <button type="button" className="link-button" onClick={() => setMode("unidentified")}>
            propose it as a new coral
          </button>
          .
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={reset}>
          Cancel
        </button>
      </div>
    </div>
  );
}
