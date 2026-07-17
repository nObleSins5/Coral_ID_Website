# Design Brief — Tank Callout Engine + Tank Status Header

*Shaped 2026-07-16, following the dashboard-flow critique ([dashboard-ux-critique.md](dashboard-ux-critique.md), P0 items 1–2). Confirmed decisions from discovery folded in below.*

## 1. Feature Summary

A pure aggregation function (`lib/tank-callouts.ts`) that compares what a tank's corals *need* (parameter ranges, light/flow demand, rolled up from each specimen's morph with genus-level fallback) against what the tank *actually has* (latest logged readings, logged equipment presence) — surfaced as a small set of calm, one-line advisory chips at the top of `/tank/[id]`. This is the feature that gives existing logging (parameters, equipment) a payoff: right now data goes in and nothing ever compares it to anything.

## 2. Primary User Action

Glance at the tank page and immediately understand: is anything currently mismatched between what's living here and what's being maintained? No click required to see it; click through only to fix it.

## 3. Design Direction

- **Color strategy**: Restrained (project default, DESIGN.md — product register). Chips use the existing pill/badge vocabulary (`.pill`, `CareDifficultyPill`/`CarePill` pattern in `coral-ui.tsx`) rather than inventing a new component family. Only the existing semantic colors (`--accent-text` for informational, `--danger` reserved for genuinely out-of-range, `--muted`/neutral for onboarding/no-data) — no new hues.
- **Theme scene sentence**: a hobbyist glancing at their tank page on a phone, mid-task, wanting a fast fact check, not a dashboard to study — reinforces *quiet* over *dashboard-loud*. (Matches PRODUCT.md's brand personality: "an expert who's glad to help, not a lab instrument.")
- **Anchor references**: Neptune Systems' existing precision-without-decoration pattern (per PRODUCT.md) — plain, specific, numeric claims, no colored progress-bar theatrics. Not a "health score" gauge, not a traffic-light dashboard.

## 4. Scope

- **Fidelity**: production-ready.
- **Breadth**: one surface — the top of `/tank/[id]`, between the h1/subtitle and the grid. Does *not* touch the dashboard card (that's a separate, already-deferred item) or the husbandry page itself.
- **Interactivity**: server-rendered (no client JS needed — same pattern as the rest of `/tank/[id]`, which is an async server component). Chips are plain links where they point somewhere (e.g. into the husbandry page or the parameter log), static text otherwise.
- **Time intent**: ship-quality, not exploratory.

## 5. Layout Strategy

A single quiet block directly under the existing "Mixed · 75 gal · Equipment & dosing" subtitle line, before the grid:

```
[Tank name — existing h1]
[Mixed · 75 gal · Equipment & dosing — existing subtitle]

[Tank status block — NEW]
  Last logged: Alk 8.2 dKH, Ca 420 ppm · 2h ago         ← neutral status line
  ⚠ Nitrate 6 ppm — outside Rainbow Trachy's 0–5 ppm     ← outlier chip (only if any)
  ⚠ 3 high-light corals · no light logged →              ← equipment-gap chip (only if any)

[Grid — existing]
```

No card/box around it — per the impeccable card-ban guidance ("cards are the lazy answer"), this reads as a status *line*, not a widget, consistent with how the subtitle line already works. Chips wrap naturally on mobile (flex-wrap, not a grid) — never causes horizontal scroll (this pass explicitly does NOT fix the grid's own overflow bug; that's `/impeccable adapt`, deferred).

Zero-callout state ("everything's fine") shows only the neutral "Last logged" line — no green checkmark theatrics, no "all good!" banner. Silence *is* the all-clear signal, consistent with calm-advisory tone.

## 6. Key States

| State | What renders |
|---|---|
| New tank, 0 corals, 0 readings | One quiet onboarding line only, no chips: *"Add a coral and log a reading to see status here."* (confirmed in discovery) |
| Corals placed, 0 readings ever | *"No parameters logged yet"* neutral line + equipment-gap chips still apply (equipment sufficiency doesn't require a reading to check) |
| Readings exist, all in range, equipment present for all demand tiers | Neutral "Last logged: …" line only |
| One or more params out of the aggregated target band | Outlier chip per parameter, naming the specific coral(s) it's out of range for (confirmed: overlap-band + named-outlier approach) |
| Tank holds a light/flow-demand tier with zero matching equipment logged | Equipment-gap chip, presence-only check (confirmed: no wattage/PAR inference) |
| Stale readings (>N days old — reuse existing "freshness" concept from the deleted `formatFreshness`, or introduce a simple threshold) | Neutral line reads "Last logged: … · 12 days ago" — age is always shown; no separate "stale" alarm chip for v1 (keep this pass narrow; a stale-data callout can be a fast follow, not blocking) |
| Specimen has no taxon (private/unidentified) | Excluded from aggregation — only taxon-linked specimens contribute demand, since there's no rec_* data to aggregate for an unidentified coral |
| Genus-unknown placeholder specimen | Same as above — excluded (no genus/species care data to roll up) |

## 7. Interaction Model

No modals, no toasts, no client state. The status block is rendered server-side alongside the rest of `/tank/[id]`'s existing data fetch (extend the tank page's `Promise.all` fetches rather than a new round trip). Equipment-gap chip links to `/tank/[id]/husbandry`; outlier chip links to the dashboard's parameter log section (`/dashboard#`-style anchor, or just plain text if no natural link target exists — don't force a link where none is meaningful). Nothing here requires a page reload or form submission; it's read-only derived text.

## 8. Content Requirements

Tone: plain, specific, numeric, never alarmist. Follow the pattern already established in `docs/dashboard-ux-critique.md`'s examples:
- `"Alk 7.2 dKH — below the 8–9.5 dKH your 3 SPS corals want"`
- `"Nitrate 6 ppm — outside Rainbow Trachy's 0–5 ppm range (your other corals are fine with this)"`
- `"3 high-light corals · no light logged →"`
- `"Add a coral and log a reading to see status here."`
- `"Last logged: Alk 8.2 dKH, Ca 420 ppm · 2 hours ago"`

No exclamation points, no "Uh oh," no red-alert iconography beyond a single neutral ⚠ glyph (or none at all — a plain text prefix may read calmer than an emoji; worth trying both during implementation and picking whichever reads less alarmist against DESIGN.md's palette).

## 9. Aggregation Rules (the part that needed a decision pass)

**Parameter targets**, per tank:
1. Gather all *taxon-linked* specimens' morphs (skip unidentified/genus-unknown specimens — see Key States).
2. For each of the 6 parameters (alk/ca/mg/nitrate/phosphate/temp), collect each contributing morph's `[min, max]` (after genus fallback — reuse `withGenusCareDefaults`'s logic, don't reinvent it).
3. Compute the **intersection band**: `target_min = max(all mins)`, `target_max = min(all maxes)`. If `target_min <= target_max`, that's the shared target — no conflict, don't call anything out beyond a normal out-of-range check against this band.
4. If `target_min > target_max` (a genuine conflict — no single value satisfies everyone), there is no valid shared target. In that case: report status **per distinct range**, not a fabricated intersection. Group morphs by identical (or overlapping) range, and if the tank's latest reading falls outside a given group's range, name that group's coral(s) specifically. This is the "outlier chip" case from the confirmed discovery answer — the chip names which coral is unhappy, it doesn't claim there's one universal target when there isn't.
5. A parameter with zero contributing morphs (no taxon-linked specimens at all) produces no target and no callout for that parameter — only the neutral "last logged" line if a reading exists.

**Equipment sufficiency** (confirmed: presence-only, very subtle):
1. Roll up the tank's taxon-linked specimens' `light_level_code`/`flow_level_code` (post genus-fallback), take the **highest tier present** (e.g. any `high` present → tank "needs" high-tier consideration).
2. Check: does the tank have **any** non-removed `equipment` row with `equipment_type_code = 'light'` (respectively `'flow'`)? Presence only — no wattage/GPH/PAR estimation, exactly as confirmed (avoids the same false-precision trap as the earlier lighting-correction discussion).
3. If the tank has a `medium` or `high` demand tier present and **zero** matching equipment logged, emit one gap chip per missing category (light/flow). If only `low` demand exists, don't bother calling out missing equipment — low-demand corals not having dedicated equipment logged isn't really a gap worth a chip (avoids noise for the softy/mushroom-only tank case).
4. This check explicitly does **not** try to validate that logged equipment is *adequate* for the tier (e.g., a single low-wattage light logged still "counts" as light-logged) — that's exactly the false-precision problem flagged in discovery. Presence is the whole check for v1.

**Freshness**: always show the reading age in the neutral line; no separate threshold-based "stale" chip in this pass (explicitly deferred per Key States, to keep the aggregation surface narrow and shippable).

## 10. Recommended References

- `reference/product.md` (already loaded) — state-rich semantic vocabulary, restrained color, component consistency.
- `reference/clarify.md` — worth a pass on the exact chip copy once implemented, since tone calibration (plain vs. alarmist) is the main risk here.
- `reference/typeset.md` — not expected to be needed; this is plain body text at existing scale, no new type step.

## 11. Open Questions (asserted defaults, not blocking)

- **Chip ordering when multiple exist**: assert equipment-gap chips before parameter-outlier chips (setup problems are usually upstream of parameter drift) — revisit if it reads oddly in practice.
- **Where exactly the intersection math lives relative to existing `withGenusCareDefaults`**: assert it's a new pure function in `lib/tank-callouts.ts` that *calls* `withGenusCareDefaults` (already exported-shaped in `lib/wiki.ts`) rather than duplicating the fallback logic — keeps one source of truth for genus defaults.
- **Stale-reading chip**: explicitly deferred (see Key States) rather than scoped in — flag as a fast-follow if you want it revisited.

---

**Anti-goals** (what this should NOT become): not a health score/gauge, not a colored traffic-light system, not a place that invents confidence from wattage numbers it can't actually verify (this is the same restraint applied to the lighting-correction discussion — presence-only, no false precision), not a dashboard-card feature in this pass, not a fix for the grid's mobile overflow bug (separate, deferred work).
