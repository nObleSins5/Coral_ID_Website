"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getColorKeyForTaxon, proposeIdentification } from "@/app/identify/actions";
import type { SearchableMorph } from "@/lib/wiki";
import { ElementColorKey, type ColorRange } from "@/components/coral-ui";
import { PhotoColorSampler } from "@/components/photo-color-sampler";

type Genus = { id: string; name: string };

// Shared "propose an identification for this photo" form — used both by the
// /identify queue (IdentifyQueue) and, for a private/local specimen, the
// specimen page's escalation into the community pipeline (same photo, no
// re-upload; proposeIdentification flips it public — see app/identify/actions.ts).
export function ProposeIdentificationForm({
  photoId,
  photoUrl,
  morphs,
  genera,
  onDone,
}: {
  photoId: string;
  photoUrl: string;
  morphs: SearchableMorph[];
  genera: Genus[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [matched, setMatched] = useState<SearchableMorph | null>(null);
  const [isAlias, setIsAlias] = useState(false);
  const [aliasName, setAliasName] = useState("");
  const [newMorphMode, setNewMorphMode] = useState(false);
  const [newGenusId, setNewGenusId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [colorKey, setColorKey] = useState<{
    colorRanges: ColorRange[];
    suggestedPositions: string[];
  } | null>(null);
  const [showSampler, setShowSampler] = useState(false);

  // Clears/sets the matched coral and resets the (now stale) reference-color
  // state that goes with it — called from every place `matched` changes,
  // rather than as a side effect of an effect (avoids a same-render
  // cascading setState).
  function selectMatch(m: SearchableMorph | null) {
    setMatched(m);
    setColorKey(null);
    setShowSampler(false);
  }

  // Fetch the matched coral's reference colors for comparison — purely
  // visual, nothing here is submitted or stored.
  useEffect(() => {
    if (!matched) return;
    let cancelled = false;
    getColorKeyForTaxon(matched.id).then((result) => {
      if (!cancelled) setColorKey(result);
    });
    return () => {
      cancelled = true;
    };
  }, [matched]);

  const results = useMemo(() => {
    if (matched || newMorphMode || query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return morphs
      .filter((m) => m.name.toLowerCase().includes(q) || m.genusName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, matched, newMorphMode, morphs]);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("photo_id", photoId);
    if (matched) {
      formData.set("existing_taxon_id", matched.id);
      if (isAlias && aliasName.trim()) formData.set("alias_name", aliasName.trim());
    } else if (newMorphMode) {
      formData.set("new_name", query.trim());
      formData.set("new_genus_id", newGenusId);
    } else {
      setError(
        "Pick an existing coral above, or use “Can’t find it?” below to propose an undocumented coral.",
      );
      return;
    }
    startTransition(async () => {
      const result = await proposeIdentification(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        onDone();
        router.refresh();
      }
    });
  }

  return (
    <form className="propose-form" action={handleSubmit}>
      {!newMorphMode ? (
        <>
          <label>Search existing corals</label>
          <input
            value={matched ? matched.name : query}
            onChange={(e) => {
              selectMatch(null);
              setQuery(e.target.value);
            }}
            placeholder="e.g. Walt Disney"
          />
          {results.length > 0 && (
            <div className="taxon-results">
              {results.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  className="taxon-result"
                  onClick={() => {
                    selectMatch(m);
                    setAliasName(query);
                  }}
                >
                  {m.name} <span className="muted">({m.genusName})</span>
                </button>
              ))}
            </div>
          )}

          {matched && (
            <div className="alias-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={isAlias}
                  onChange={(e) => setIsAlias(e.target.checked)}
                />{" "}
                I call it something else (a nickname or regional name)
              </label>
              {isAlias && (
                <input
                  value={aliasName}
                  onChange={(e) => setAliasName(e.target.value)}
                  placeholder="What do you call it?"
                />
              )}
            </div>
          )}

          {matched && (
            <div className="card" style={{ marginTop: "0.5rem" }}>
              <p style={{ marginTop: 0, marginBottom: "0.4rem" }}>
                <a href={`/coral/${matched.genusSlug}/${matched.slug}`} target="_blank" rel="noopener">
                  See {matched.name}&apos;s full wiki page →
                </a>
              </p>
              {colorKey ? (
                colorKey.colorRanges.length > 0 ? (
                  <ElementColorKey
                    colorRanges={colorKey.colorRanges}
                    suggestedPositions={
                      colorKey.suggestedPositions.length > 0 ? colorKey.suggestedPositions : undefined
                    }
                  />
                ) : (
                  <p className="muted" style={{ fontSize: "0.85rem" }}>
                    No colors documented for {matched.name} yet.
                  </p>
                )
              ) : (
                <p className="muted" style={{ fontSize: "0.85rem" }}>Loading colors…</p>
              )}
              {!showSampler ? (
                <button type="button" className="btn-secondary" onClick={() => setShowSampler(true)}>
                  Compare colors from your photo
                </button>
              ) : (
                <PhotoColorSampler photoUrl={photoUrl} />
              )}
            </div>
          )}

          <p className="muted propose-switch">
            Can&apos;t find it?{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setNewMorphMode(true);
                selectMatch(null);
              }}
            >
              This might be an undocumented coral
            </button>
          </p>
        </>
      ) : (
        <>
          <label htmlFor="new-name">Name</label>
          <input
            id="new-name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Rainbow Fire Acro"
          />
          <label htmlFor="new-genus">Genus</label>
          <select
            id="new-genus"
            value={newGenusId}
            onChange={(e) => setNewGenusId(e.target.value)}
          >
            <option value="">Choose a genus</option>
            {genera.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
            <option value="unsure">Not sure — genus unknown</option>
          </select>
          <p className="muted propose-switch">
            <button type="button" className="link-button" onClick={() => setNewMorphMode(false)}>
              Actually, let me search existing corals
            </button>
          </p>
        </>
      )}

      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit suggestion"}
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
