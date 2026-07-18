"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getColorKeyForTaxon, proposeIdentification } from "@/app/identify/actions";
import type { GenusOption, SearchableMorph } from "@/lib/wiki";
import { ElementColorKey, type ColorRange } from "@/components/coral-ui";
import { PhotoColorSampler } from "@/components/photo-color-sampler";

type Genus = { id: string; name: string };

// A genus targeted directly ("I only know the genus" mode) rather than a
// specific morph — same shape the color-key/link logic needs as a matched
// SearchableMorph, but there's no morph slug to link to.
type MatchedGenus = { id: string; name: string; slug: string };

// Shared "propose an identification for this photo" form — used both by the
// /identify queue (IdentifyQueue) and, for a private/local specimen, the
// specimen page's escalation into the community pipeline (same photo, no
// re-upload; proposeIdentification flips it public — see app/identify/actions.ts).
export function ProposeIdentificationForm({
  photoId,
  photoUrl,
  morphs,
  genera,
  genusOptions,
  onDone,
}: {
  photoId: string;
  photoUrl: string;
  morphs: SearchableMorph[];
  genera: Genus[];
  genusOptions: GenusOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [matched, setMatched] = useState<SearchableMorph | null>(null);
  const [isAlias, setIsAlias] = useState(false);
  const [aliasName, setAliasName] = useState("");
  const [genusOnlyMode, setGenusOnlyMode] = useState(false);
  const [matchedGenus, setMatchedGenus] = useState<MatchedGenus | null>(null);
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
    setMatchedGenus(null);
    setColorKey(null);
    setShowSampler(false);
  }

  function selectGenus(id: string) {
    const g = genusOptions.find((g) => g.id === id) ?? null;
    setMatched(null);
    setMatchedGenus(g ? { id: g.id, name: g.name, slug: g.slug } : null);
    setColorKey(null);
    setShowSampler(false);
  }

  // Fetch the matched coral's (or genus's) reference colors for comparison —
  // purely visual, nothing here is submitted or stored.
  useEffect(() => {
    const targetId = matched?.id ?? matchedGenus?.id;
    if (!targetId) return;
    let cancelled = false;
    getColorKeyForTaxon(targetId).then((result) => {
      if (!cancelled) setColorKey(result);
    });
    return () => {
      cancelled = true;
    };
  }, [matched, matchedGenus]);

  const results = useMemo(() => {
    if (matched || newMorphMode || genusOnlyMode || query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return morphs
      .filter((m) => m.name.toLowerCase().includes(q) || m.genusName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, matched, newMorphMode, genusOnlyMode, morphs]);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("photo_id", photoId);
    if (matched) {
      formData.set("existing_taxon_id", matched.id);
      if (isAlias && aliasName.trim()) formData.set("alias_name", aliasName.trim());
    } else if (genusOnlyMode) {
      if (!matchedGenus) {
        setError("Pick a genus above.");
        return;
      }
      // Targets the genus's own taxon_node directly — no alias/new name, so
      // this never invents a morph name. See getGenusOnlyQueue (lib/wiki.ts)
      // for where a photo confirmed here shows up.
      formData.set("existing_taxon_id", matchedGenus.id);
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
      {!newMorphMode && !genusOnlyMode ? (
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
            Only sure of the genus?{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setGenusOnlyMode(true);
                selectMatch(null);
              }}
            >
              I know the genus, not the exact morph
            </button>
          </p>
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
      ) : genusOnlyMode ? (
        <>
          <label htmlFor="genus-only-select">Genus</label>
          <select
            id="genus-only-select"
            value={matchedGenus?.id ?? ""}
            onChange={(e) => selectGenus(e.target.value)}
          >
            <option value="">Choose a genus</option>
            {genusOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            No name needed — this just confirms the genus. The community can
            still narrow it down to an exact morph later.
          </p>

          {matchedGenus && (
            <div className="card" style={{ marginTop: "0.5rem" }}>
              <p style={{ marginTop: 0, marginBottom: "0.4rem" }}>
                <a href={`/coral/${matchedGenus.slug}`} target="_blank" rel="noopener">
                  See {matchedGenus.name}&apos;s wiki page →
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
                    No genus-level colors documented yet.
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
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setGenusOnlyMode(false);
                selectGenus("");
              }}
            >
              Actually, let me search existing corals
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
