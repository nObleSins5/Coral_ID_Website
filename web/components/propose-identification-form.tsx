"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getColorKeyForTaxon, proposeIdentification } from "@/app/identify/actions";
import type { CategoryOption, GenusOption, SearchableMorph } from "@/lib/wiki";
import { ElementColorKey, type ColorRange } from "@/components/coral-ui";
import { PhotoColorSampler } from "@/components/photo-color-sampler";
import { CategoryGenusPicker } from "@/components/category-genus-picker";

// Shared "propose an identification for this photo" form — used both by the
// /identify queue (IdentifyQueue) and, for a private/local specimen, the
// specimen page's escalation into the community pipeline (same photo, no
// re-upload; proposeIdentification flips it public — see app/identify/actions.ts).
//
// One unified "genus + morph name" panel (as opposed to previously separate,
// mutually-exclusive "genus only" / "new morph" modes) — a member can submit
// a genus alone, a morph name alone, or both together in a single pass. Both
// fields sit behind the same category-first cascading picker
// (CategoryGenusPicker) so picking a type narrows the genus list instead of
// dumping every genus in the registry on the user.
export function ProposeIdentificationForm({
  photoId,
  photoUrl,
  morphs,
  categories,
  genusOptions,
  onDone,
}: {
  photoId: string;
  photoUrl: string;
  morphs: SearchableMorph[];
  categories: CategoryOption[];
  genusOptions: GenusOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [matched, setMatched] = useState<SearchableMorph | null>(null);
  const [isAlias, setIsAlias] = useState(false);
  const [aliasName, setAliasName] = useState("");

  // Proposing something not already in the registry — a genus, a morph
  // name, or both, filled in in any combination.
  const [proposeMode, setProposeMode] = useState(false);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [genusId, setGenusId] = useState("");
  const [newName, setNewName] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [colorKey, setColorKey] = useState<{
    colorRanges: ColorRange[];
    suggestedPositions: string[];
  } | null>(null);
  const [showSampler, setShowSampler] = useState(false);

  const selectedGenus = genusId ? (genusOptions.find((g) => g.id === genusId) ?? null) : null;

  // Clears/sets the matched coral and resets the (now stale) reference-color
  // state that goes with it.
  function selectMatch(m: SearchableMorph | null) {
    setMatched(m);
    setColorKey(null);
    setShowSampler(false);
    if (m) {
      // A search hit that's already in the wiki (e.g. "Walt Disney" ->
      // Acropora) pre-fills the hierarchy to that coral's own type/genus,
      // so the reference color key and any follow-on proposal already
      // starts scoped correctly instead of defaulting to "Any type."
      setCategorySlug(m.categorySlug);
      setGenusId(m.genusId);
    }
  }

  // Fetch the matched coral's (or genus's) reference colors for comparison —
  // purely visual, nothing here is submitted or stored.
  useEffect(() => {
    const targetId = matched?.id ?? (proposeMode ? genusId : null);
    if (!targetId) return;
    let cancelled = false;
    getColorKeyForTaxon(targetId).then((result) => {
      if (!cancelled) setColorKey(result);
    });
    return () => {
      cancelled = true;
    };
  }, [matched, proposeMode, genusId]);

  const results = useMemo(() => {
    if (matched || proposeMode || query.trim().length < 2) return [];
    const q = query.toLowerCase();
    let candidates = morphs;
    if (genusId) candidates = candidates.filter((m) => m.genusId === genusId);
    else if (categorySlug) candidates = candidates.filter((m) => m.categorySlug === categorySlug);
    return candidates
      .filter((m) => m.name.toLowerCase().includes(q) || m.genusName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, matched, proposeMode, morphs, categorySlug, genusId]);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("photo_id", photoId);
    if (matched) {
      formData.set("existing_taxon_id", matched.id);
      if (isAlias && aliasName.trim()) formData.set("alias_name", aliasName.trim());
    } else if (proposeMode) {
      const name = newName.trim();
      if (!name && !genusId) {
        setError("Give a genus, a name, or both.");
        return;
      }
      if (name) {
        // A name was given — submit as a (possibly new) morph, tagged to
        // whichever genus was picked, or "genus unknown" if none was.
        formData.set("new_name", name);
        formData.set("new_genus_id", genusId || "unsure");
      } else {
        // Genus only, no name — targets the genus's own taxon_node
        // directly, same as before: never invents a morph name. See
        // getGenusOnlyQueue (lib/wiki.ts) for where this shows up.
        formData.set("existing_taxon_id", genusId);
      }
    } else {
      setError(
        "Pick an existing coral above, or use “Can’t find it?” below to propose a genus and/or a new name.",
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
      {!proposeMode ? (
        <>
          <label>Type / genus, if you know it (optional — narrows the search below)</label>
          <CategoryGenusPicker
            categories={categories}
            genusOptions={genusOptions}
            categorySlug={categorySlug}
            genusId={genusId}
            onCategoryChange={(slug) => {
              setCategorySlug(slug);
              selectMatch(null);
            }}
            onGenusChange={(id) => {
              setGenusId(id);
              selectMatch(null);
            }}
          />

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
                setProposeMode(true);
                selectMatch(null);
                setNewName(query);
                setQuery("");
              }}
            >
              Propose a genus, a new name, or both
            </button>
          </p>
        </>
      ) : (
        <>
          <p className="muted" style={{ fontSize: "0.85rem", marginTop: 0 }}>
            Fill in whichever you know — a genus alone just confirms the type; a name alone
            proposes an undocumented coral under &quot;genus unknown&quot;; both together proposes
            a new, named morph under that genus.
          </p>
          <CategoryGenusPicker
            categories={categories}
            genusOptions={genusOptions}
            categorySlug={categorySlug}
            genusId={genusId}
            onCategoryChange={setCategorySlug}
            onGenusChange={(id) => {
              setGenusId(id);
              setColorKey(null);
              setShowSampler(false);
            }}
            genusLabel="Genus, if known"
          />

          <label htmlFor="new-name">Name, if known</label>
          <input
            id="new-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Rainbow Fire Acro"
          />

          {genusId && (
            <div className="card" style={{ marginTop: "0.5rem" }}>
              <p style={{ marginTop: 0, marginBottom: "0.4rem" }}>
                <a href={`/coral/${selectedGenus?.slug}`} target="_blank" rel="noopener">
                  See {selectedGenus?.name}&apos;s wiki page →
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
                setProposeMode(false);
                setGenusId("");
                setCategorySlug(null);
                setNewName("");
                setColorKey(null);
                setShowSampler(false);
              }}
            >
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
