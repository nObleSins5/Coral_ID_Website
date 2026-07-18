"use client";

import { useMemo, useState, useTransition } from "react";
import type { SearchableMorph } from "@/lib/wiki";
import {
  deleteColorRange,
  getColorEntryModerationList,
  getColorRangesForModeration,
  upsertColorRange,
  type ColorEntryModerationRow,
  type ColorRangeForModeration,
} from "@/app/moderate/actions";
import { stepsForTemplate } from "@/lib/anatomy-steps";
import { ColorSwatch, type ColorRange as SwatchColorRange } from "@/components/coral-ui";

const PATTERNS: { code: string; label: string; hint: string }[] = [
  { code: "solid", label: "Solid (single color)", hint: "One flat color, no blend." },
  {
    code: "range",
    label: "Range / gradient (from-to)",
    hint: "A gradual blend across the coral, like green fading to blue at the tips — enter 2 stops.",
  },
  { code: "rainbow", label: "Rainbow / multicolor", hint: "Several hard-edged, distinct colors side by side — not a blend." },
  { code: "banded", label: "Banded", hint: "Regular repeating stripes." },
  { code: "spotted", label: "Spotted / speckled", hint: "Small distinct dots of a second color over a base." },
  { code: "mottled", label: "Mottled", hint: "Larger, soft-edged blotches of a second color." },
  { code: "tipped", label: "Tipped", hint: "A blend from base color into a distinct tip color." },
  { code: "ringed", label: "Ringed", hint: "Concentric rings of alternating color from a center point." },
];

const LIGHTING = [
  { code: "daylight", label: "Daylight" },
  { code: "actinic", label: "Actinic (blue)" },
  { code: "mixed", label: "Mixed" },
  { code: "unsure", label: "Unsure" },
];

type ElementType = { code: string; label: string };

function formatRelative(iso: string | null): string {
  if (!iso) return "Never entered";
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// "Which corals have I set up, and when did I last touch them" — see
// getColorEntryModerationList in app/moderate/actions.ts. Sortable over the
// small (~101-row) dataset client-side, same scale assumption as
// getAllMorphsForSearch. Clicking a row jumps straight into the editor below
// instead of requiring a re-search.
function ColorEntryActivityList({ onSelectTaxonId }: { onSelectTaxonId: (id: string) => void }) {
  const [rows, setRows] = useState<ColorEntryModerationRow[] | null>(null);
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [onlyNeverEntered, setOnlyNeverEntered] = useState(false);
  const [loaded, setLoaded] = useState(false);

  function load() {
    setLoaded(true);
    startTransition(async () => {
      const result = await getColorEntryModerationList();
      if (result.error) setError(result.error);
      else setRows(result.rows ?? []);
    });
  }

  if (!loaded) {
    return (
      <button type="button" onClick={load}>
        Show my corals &amp; last activity
      </button>
    );
  }

  const visible = onlyNeverEntered ? (rows ?? []).filter((r) => r.lastActivity === null) : rows ?? [];

  return (
    <div className="color-mod-activity">
      {loading && rows === null ? <p className="muted">Loading…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {rows ? (
        <>
          <label className="color-mod-activity-filter">
            <input
              type="checkbox"
              checked={onlyNeverEntered}
              onChange={(e) => setOnlyNeverEntered(e.target.checked)}
            />
            Only show never-entered corals
          </label>
          <div className="color-mod-activity-table">
            <div className="color-mod-activity-row color-mod-activity-head">
              <span>Coral</span>
              <span>Genus</span>
              <span>Colors</span>
              <span>Last activity</span>
            </div>
            {visible.map((r) => (
              <button
                type="button"
                key={r.id}
                className="color-mod-activity-row"
                onClick={() => onSelectTaxonId(r.id)}
              >
                <span>{r.name}</span>
                <span className="muted">{r.genusName}</span>
                <span>{r.colorCount}</span>
                <span className={r.lastActivity ? "" : "muted"}>{formatRelative(r.lastActivity)}</span>
              </button>
            ))}
            {visible.length === 0 ? <p className="muted">Nothing matches.</p> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function hexesFor(range: ColorRangeForModeration | null): string[] {
  if (!range || range.color_stops.length === 0) return [""];
  return range.color_stops.map((s) => s.hex);
}

function isValidHex(h: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(h);
}

// One color_range as an editable row — new (no id yet) or existing. Each row
// is its own form; saving one color doesn't touch the others. Stops are now
// a real add/remove list, each with a paired <input type="color"> + hex
// text field (kept in sync both ways) instead of one comma-separated blob,
// plus a live ColorSwatch preview — the exact component the wiki/funnel
// render, so what the moderator sees is what actually ships.
function ColorRangeRow({
  taxonId,
  range,
  elementTypes,
  suggestedPosition,
  labelSuggestions,
  onSaved,
  onDeleted,
}: {
  taxonId: string;
  range: ColorRangeForModeration | null;
  elementTypes: ElementType[];
  suggestedPosition?: string;
  labelSuggestions: Record<string, string>;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stops, setStops] = useState<string[]>(hexesFor(range));
  const [pattern, setPattern] = useState(range?.color_pattern_code ?? "solid");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [label, setLabel] = useState(range?.label ?? "");
  // Once a range already has a saved label, or the moderator types their
  // own, stop auto-filling — this is a consistency AID, not a lock (the
  // field always stays free-text/editable, per explicit request).
  const [labelTouched, setLabelTouched] = useState(!!range?.label);

  // Exact, ordered hex signature — matches how getColorLabelSuggestions
  // (lib/wiki.ts) builds its lookup, so "the same hex stops" reliably
  // resolves to whatever label was most commonly used for them elsewhere
  // in the registry (e.g. #77BB41 always suggesting "Neon green" instead
  // of drifting to "Bright green" / "Green" across different sessions).
  // Derived at render time (not synced via an effect + setState) — the
  // suggestion is only ever a fallback DISPLAY value until the moderator
  // actually types, so there's nothing to keep in sync.
  const signature = stops
    .filter(isValidHex)
    .map((h) => h.toUpperCase())
    .join(",");
  const suggestion = labelSuggestions[signature];
  const displayLabel = labelTouched ? label : (suggestion ?? label);
  const hasSuggestion = !labelTouched && Boolean(suggestion);

  const validStops = stops.filter(isValidHex);
  const previewRange: SwatchColorRange = {
    position_label: range?.position_label ?? null,
    color_pattern_code: pattern,
    label: displayLabel || null,
    approx_percent: null,
    color_stops: validStops.map((hex, ordinal) => ({ hex, ordinal })),
  };
  const patternInfo = PATTERNS.find((p) => p.code === pattern);

  function setStop(i: number, hex: string) {
    setStops((prev) => prev.map((s, idx) => (idx === i ? hex : s)));
  }
  function addStop() {
    setStops((prev) => [...prev, "#FFFFFF"]);
  }
  function removeStop(i: number) {
    setStops((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("hexes", stops.filter((s) => s.trim()).join(","));
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
          <select name="position_label" defaultValue={range?.position_label ?? suggestedPosition ?? ""}>
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
          <select
            name="color_pattern_code"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            required
          >
            {PATTERNS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
          {patternInfo ? <p className="muted color-mod-pattern-hint">{patternInfo.hint}</p> : null}
        </div>
        <div>
          <label>Label</label>
          <input
            name="label"
            value={displayLabel}
            onChange={(e) => {
              setLabel(e.target.value);
              setLabelTouched(true);
            }}
            placeholder="e.g. Orange face"
          />
          {hasSuggestion ? (
            <p className="muted color-mod-label-hint">
              Auto-filled — this hex has been labeled this way before. Edit freely.
            </p>
          ) : null}
        </div>
      </div>

      <label>Colors</label>
      <div className="color-mod-stops">
        {stops.map((hex, i) => (
          <div className="color-mod-stop" key={i}>
            <input
              type="color"
              value={isValidHex(hex) ? hex : "#888888"}
              onChange={(e) => setStop(i, e.target.value.toUpperCase())}
              aria-label={`Color picker for stop ${i + 1}`}
            />
            <input
              value={hex}
              onChange={(e) => setStop(i, e.target.value)}
              placeholder="#F28C00"
              aria-label={`Hex for stop ${i + 1}`}
            />
            {stops.length > 1 ? (
              <button type="button" className="btn-secondary" onClick={() => removeStop(i)}>
                Remove
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={addStop}>
          + Add stop
        </button>
      </div>
      {validStops.length > 0 ? (
        <div className="color-mod-preview">
          <ColorSwatch range={previewRange} title="Live preview" />
          <span className="muted">Live preview — matches what ships to the wiki/funnel</span>
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

// Groups a taxon's ranges by the genus's anatomy_template_code's step
// grouping (lib/anatomy-steps.ts) — same framework the identify funnel uses
// — instead of one flat list, plus a running "% of coral" total per group
// (soft hint, not a hard validation — percent is optional, and 0%/not-
// recorded are different facts, see docs/color-percent-feature-brief.md §6).
function GroupedRanges({
  taxonId,
  ranges,
  anatomyTemplateCode,
  elementTypes,
  labelSuggestions,
  onSaved,
  onDeleted,
}: {
  taxonId: string;
  ranges: ColorRangeForModeration[];
  anatomyTemplateCode: string | null;
  elementTypes: ElementType[];
  labelSuggestions: Record<string, string>;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const steps = stepsForTemplate(anatomyTemplateCode);
  if (steps.length === 0) {
    return (
      <>
        {ranges.map((r) => (
          <ColorRangeRow
            key={r.id}
            taxonId={taxonId}
            range={r}
            elementTypes={elementTypes}
            labelSuggestions={labelSuggestions}
            onSaved={onSaved}
            onDeleted={onDeleted}
          />
        ))}
        <ColorRangeRow
          taxonId={taxonId}
          range={null}
          elementTypes={elementTypes}
          labelSuggestions={labelSuggestions}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      </>
    );
  }

  const byPosition = new Map<string, ColorRangeForModeration[]>();
  for (const r of ranges) {
    if (!r.position_label) continue;
    const list = byPosition.get(r.position_label) ?? [];
    list.push(r);
    byPosition.set(r.position_label, list);
  }
  const grouped = new Set(steps.flatMap((s) => s.positions));
  const other = ranges.filter((r) => !r.position_label || !grouped.has(r.position_label));

  return (
    <>
      {steps.map((step) => {
        const stepRanges = step.positions.flatMap((p) => byPosition.get(p) ?? []);
        const total = stepRanges.reduce((sum, r) => sum + (r.approx_percent ?? 0), 0);
        const hasAnyPercent = stepRanges.some((r) => r.approx_percent != null);
        // Only this step's own positions — e.g. a mushroom's "Skirt" step
        // offers skirt_1/2/3, never "Bubble on skirt" (that's a different
        // step) or anything from a different anatomy entirely. Reported
        // live: Acropora's dropdown was offering "Bubble on skirt", which
        // doesn't apply to SPS at all.
        const stepElementTypes = elementTypes.filter((e) => step.positions.includes(e.code));
        return (
          <div className="color-mod-group" key={step.key}>
            <div className="color-mod-group-head">
              <h4 style={{ margin: 0 }}>
                {step.label} {step.optional ? <span className="muted">(optional)</span> : null}
              </h4>
              {hasAnyPercent && (total < 90 || total > 110) ? (
                <span className="muted color-mod-group-total">adds up to {total}%</span>
              ) : null}
            </div>
            {stepRanges.map((r) => (
              <ColorRangeRow
                key={r.id}
                taxonId={taxonId}
                range={r}
                elementTypes={stepElementTypes}
                labelSuggestions={labelSuggestions}
                onSaved={onSaved}
                onDeleted={onDeleted}
              />
            ))}
            <ColorRangeRow
              taxonId={taxonId}
              range={null}
              elementTypes={stepElementTypes}
              suggestedPosition={step.positions[0]}
              labelSuggestions={labelSuggestions}
              onSaved={onSaved}
              onDeleted={onDeleted}
            />
          </div>
        );
      })}
      {other.length > 0 ? (
        <div className="color-mod-group">
          <h4 className="muted" style={{ margin: 0 }}>
            Other
          </h4>
          {other.map((r) => (
            <ColorRangeRow
              key={r.id}
              taxonId={taxonId}
              range={r}
              elementTypes={elementTypes}
              labelSuggestions={labelSuggestions}
              onSaved={onSaved}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

// Search-a-taxon, then edit its color_ranges directly — the first UI-based
// path for canonical color data (see docs/color-percent-feature-brief.md).
// Search reuses the exact type-to-filter pattern already used by
// QuickAddSpecimen against the same getAllMorphsForSearch() list.
export function ColorModeration({
  morphs,
  elementTypes,
  labelSuggestions,
}: {
  morphs: SearchableMorph[];
  elementTypes: ElementType[];
  labelSuggestions: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SearchableMorph | null>(null);
  const [ranges, setRanges] = useState<ColorRangeForModeration[] | null>(null);
  const [anatomyTemplateCode, setAnatomyTemplateCode] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);

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
    setLoadError(null);
    setRanges(null);
    startTransition(async () => {
      const result = await getColorRangesForModeration(taxon.id);
      if (result.error) setLoadError(result.error);
      else {
        setRanges(result.ranges ?? []);
        setAnatomyTemplateCode(result.anatomyTemplateCode ?? null);
      }
    });
  }

  function loadById(id: string) {
    const taxon = morphs.find((m) => m.id === id);
    if (taxon) loadRanges(taxon);
  }

  function refresh() {
    if (selected) loadRanges(selected);
  }

  function backToSearch() {
    setSelected(null);
    setRanges(null);
    setLoadError(null);
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
          <ColorEntryActivityList onSelectTaxonId={loadById} />
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
            <GroupedRanges
              taxonId={selected.id}
              ranges={ranges}
              anatomyTemplateCode={anatomyTemplateCode}
              elementTypes={elementTypes}
              labelSuggestions={labelSuggestions}
              onSaved={refresh}
              onDeleted={refresh}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
