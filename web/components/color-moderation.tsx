"use client";

import { useMemo, useState, useTransition } from "react";
import type { SearchableMorph } from "@/lib/wiki";
import {
  deleteColorRange,
  getColorRangesForModeration,
  upsertColorRange,
  type ColorRangeForModeration,
} from "@/app/moderate/actions";

const PATTERNS = [
  { code: "solid", label: "Solid (single color)" },
  { code: "range", label: "Range / gradient (from-to)" },
  { code: "rainbow", label: "Rainbow / multicolor" },
  { code: "banded", label: "Banded" },
  { code: "spotted", label: "Spotted / speckled" },
  { code: "mottled", label: "Mottled" },
  { code: "tipped", label: "Tipped" },
  { code: "ringed", label: "Ringed" },
];

const LIGHTING = [
  { code: "daylight", label: "Daylight" },
  { code: "actinic", label: "Actinic (blue)" },
  { code: "mixed", label: "Mixed" },
  { code: "unsure", label: "Unsure" },
];

type ElementType = { code: string; label: string };

function hexesFor(range: ColorRangeForModeration | null): string {
  if (!range) return "";
  return range.color_stops.map((s) => s.hex).join(", ");
}

// One color_range as an editable row — new (no id yet) or existing. Each row
// is its own form; saving one color doesn't touch the others. Stops are a
// single comma-separated hex field (not a dynamic add/remove-stop widget) —
// simplest thing that supports multi-stop patterns (range/rainbow/banded),
// with a live swatch preview so a moderator can confirm what they typed.
function ColorRangeRow({
  taxonId,
  range,
  elementTypes,
  onSaved,
  onDeleted,
}: {
  taxonId: string;
  range: ColorRangeForModeration | null;
  elementTypes: ElementType[];
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hexInput, setHexInput] = useState(hexesFor(range));
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const swatches = useMemo(
    () =>
      hexInput
        .split(",")
        .map((h) => h.trim())
        .filter((h) => /^#[0-9A-Fa-f]{6}$/.test(h)),
    [hexInput],
  );

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await upsertColorRange(formData);
      if (result?.error) setError(result.error);
      else onSaved();
    });
  }

  function handleDelete() {
    if (!range) return;
    setError(null);
    const formData = new FormData();
    formData.set("id", range.id);
    startTransition(async () => {
      const result = await deleteColorRange(formData);
      if (result?.error) setError(result.error);
      else onDeleted();
    });
  }

  return (
    <form className="color-mod-row" action={handleSubmit}>
      <input type="hidden" name="id" value={range?.id ?? ""} />
      <input type="hidden" name="taxon_node_id" value={taxonId} />

      <div className="row">
        <div>
          <label>Position</label>
          <select name="position_label" defaultValue={range?.position_label ?? ""}>
            <option value="">No specific position</option>
            {elementTypes.map((e) => (
              <option key={e.code} value={e.code}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Pattern</label>
          <select name="color_pattern_code" defaultValue={range?.color_pattern_code ?? "solid"} required>
            {PATTERNS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Label</label>
          <input name="label" defaultValue={range?.label ?? ""} placeholder="e.g. Orange face" />
        </div>
      </div>

      <label>Hex color(s)</label>
      <input
        name="hexes"
        value={hexInput}
        onChange={(e) => setHexInput(e.target.value)}
        placeholder="#F28C00, #5B7A3A"
        required
      />
      {swatches.length > 0 ? (
        <div className="color-mod-swatches">
          {swatches.map((hex, i) => (
            <span key={i} className="color-mod-swatch" style={{ background: hex }} title={hex} />
          ))}
        </div>
      ) : null}

      <div className="row">
        <div>
          <label>% of coral</label>
          <input
            name="approx_percent"
            type="number"
            min={0}
            max={100}
            defaultValue={range?.approx_percent ?? ""}
            placeholder="Rough estimate"
          />
        </div>
        <div>
          <label>Lighting</label>
          <select name="lighting_condition" defaultValue={range?.lighting_condition ?? ""}>
            <option value="">Not recorded</option>
            {LIGHTING.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label>Notes (optional)</label>
      <input name="notes" defaultValue={range?.notes ?? ""} placeholder="Source, caveats, etc." />

      <div className="color-mod-row-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        {range ? (
          confirmingDelete ? (
            <>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                Delete this color? This can&apos;t be undone.
              </span>
              <button
                type="button"
                className="btn-secondary"
                disabled={pending}
                onClick={handleDelete}
                style={{ marginTop: 0 }}
              >
                Yes, delete
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmingDelete(false)}
                style={{ marginTop: 0 }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirmingDelete(true)}
              style={{ marginTop: 0 }}
            >
              Delete
            </button>
          )
        ) : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

// Search-a-taxon, then edit its color_ranges directly — the first UI-based
// path for canonical color data (see docs/color-percent-feature-brief.md).
// Search reuses the exact type-to-filter pattern already used by
// QuickAddSpecimen against the same getAllMorphsForSearch() list.
export function ColorModeration({
  morphs,
  elementTypes,
}: {
  morphs: SearchableMorph[];
  elementTypes: ElementType[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SearchableMorph | null>(null);
  const [ranges, setRanges] = useState<ColorRangeForModeration[] | null>(null);
  const [loading, startTransition] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  const results = useMemo(() => {
    if (selected || query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return morphs
      .filter((m) => m.name.toLowerCase().includes(q) || m.genusName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, selected, morphs]);

  function loadRanges(taxon: SearchableMorph) {
    setSelected(taxon);
    setQuery("");
    setAddingNew(false);
    setLoadError(null);
    setRanges(null);
    startTransition(async () => {
      const result = await getColorRangesForModeration(taxon.id);
      if (result.error) setLoadError(result.error);
      else setRanges(result.ranges ?? []);
    });
  }

  function refresh() {
    if (selected) loadRanges(selected);
  }

  function backToSearch() {
    setSelected(null);
    setRanges(null);
    setLoadError(null);
    setAddingNew(false);
  }

  return (
    <div className="card color-mod">
      {!selected ? (
        <>
          <label htmlFor="color-mod-search">Search for a coral</label>
          <input
            id="color-mod-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Walt Disney"
          />
          {results.length > 0 ? (
            <div className="color-mod-results">
              {results.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  className="header-search-result"
                  onClick={() => loadRanges(m)}
                >
                  {m.name} <span className="muted">({m.genusName})</span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="color-mod-header">
            <h3 style={{ margin: 0 }}>
              {selected.name} <span className="muted">({selected.genusName})</span>
            </h3>
            <button type="button" className="btn-secondary" onClick={backToSearch} style={{ marginTop: 0 }}>
              ← Search again
            </button>
          </div>

          {loading && ranges === null ? <p className="muted">Loading…</p> : null}
          {loadError ? <p className="error">{loadError}</p> : null}

          {ranges ? (
            <>
              {ranges.map((r) => (
                <ColorRangeRow
                  key={r.id}
                  taxonId={selected.id}
                  range={r}
                  elementTypes={elementTypes}
                  onSaved={refresh}
                  onDeleted={refresh}
                />
              ))}
              {addingNew ? (
                <ColorRangeRow
                  taxonId={selected.id}
                  range={null}
                  elementTypes={elementTypes}
                  onSaved={refresh}
                  onDeleted={refresh}
                />
              ) : (
                <button type="button" onClick={() => setAddingNew(true)}>
                  + Add a color
                </button>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
