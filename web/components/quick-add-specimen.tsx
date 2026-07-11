"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  quickAddExisting,
  quickAddLocal,
  quickAddUnidentified,
} from "@/app/tank/actions";
import type { SearchableMorph } from "@/lib/wiki";

type Genus = { id: string; name: string };
type Slot = { id: string; label: string };

// Shared bits every branch's form needs: an optional grid slot and an
// optional (or, for the "propose new" branch, required) photo.
function SlotPicker({ emptySlots }: { emptySlots: Slot[] }) {
  if (emptySlots.length === 0) return null;
  return (
    <>
      <label htmlFor="quick-add-slot">Place in slot (optional)</label>
      <select id="quick-add-slot" name="grid_slot_id" defaultValue="">
        <option value="">Leave unplaced</option>
        {emptySlots.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </>
  );
}

// Inline search + quick-add for the tank grid page's "Unplaced specimens"
// section — add a coral (known, private-nickname, or propose-new) and
// optionally place it, all without navigating to the wiki and back.
export function QuickAddSpecimen({
  tankId,
  emptySlots,
  morphs,
  genera,
}: {
  tankId: string;
  emptySlots: Slot[];
  morphs: SearchableMorph[];
  genera: Genus[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
    setOpen(false);
    setQuery("");
    setMatched(null);
    setMode("search");
    setError(null);
  }

  function handleExisting(formData: FormData) {
    setError(null);
    formData.set("tank_id", tankId);
    formData.set("taxon_node_id", matched!.id);
    startTransition(async () => {
      const result = await quickAddExisting(formData);
      if (result?.error) setError(result.error);
      else {
        reset();
        router.refresh();
      }
    });
  }

  function handleLocal(formData: FormData) {
    setError(null);
    formData.set("tank_id", tankId);
    startTransition(async () => {
      const result = await quickAddLocal(formData);
      if (result?.error) setError(result.error);
      else {
        reset();
        router.refresh();
      }
    });
  }

  function handleUnidentified(formData: FormData) {
    setError(null);
    formData.set("tank_id", tankId);
    startTransition(async () => {
      const result = await quickAddUnidentified(formData);
      if (result?.error) setError(result.error);
      else {
        reset();
        router.refresh();
      }
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
        <label htmlFor="quick-add-photo">Photo (optional)</label>
        <input
          id="quick-add-photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
        <label htmlFor="quick-add-taken-at">Date taken</label>
        <input
          id="quick-add-taken-at"
          name="taken_at"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
        <SlotPicker emptySlots={emptySlots} />
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
        <SlotPicker emptySlots={emptySlots} />
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
        <SlotPicker emptySlots={emptySlots} />
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
