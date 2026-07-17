# Design Brief — Color Proportion (% of Coral) Feature

*Shaped 2026-07-17, prompted by a live product observation: Tricolor Valida and Walt Disney Acropora currently show near-identical color-family profiles in the identify funnel despite being visually dominated by very different colors. Confirmed decisions from discovery folded in below.*

## 1. Feature Summary

Add "how much of the coral is this color" as real data, surfaced in three places: a new moderator entry UI (canonical data), the wiki morph page (display), and the identify funnel (display + a ranking nudge), plus wiring through the vision model's already-computed-but-discarded percentage guess. The schema has supported this since 2026-07-14 (`color_ranges.approx_percent`) — nothing has ever populated or read it until now.

## 2. Primary User Action

**Moderator**: search a taxon, add/edit its documented colors including how dominant each one is, save.
**Wiki visitor**: see each documented color's rough share at a glance ("80% deep green").
**Identify-funnel user**: results that visually match on the *dominant* color rank slightly above results that only share a minor/trace color — without needing the user to specify their own percentages (the funnel's colors-you-see step stays exactly as simple as it is today).

## 3. Design Direction

- **Color strategy**: Restrained (unchanged project default). The moderator UI is Product-register admin tooling — dense, plain, no decoration (matches `/moderate`'s existing alias/product review sections). The wiki-page percent display is a small, quiet addition to the existing `ElementColorKey` — a number, not a new visual system.
- **Theme scene sentence**: the moderator is at a desk doing careful reference work (comparing photos, sourcing citations) — unhurried, precision-first, the opposite of the hobbyist's phone-in-hand urgency elsewhere in the product. The wiki/funnel-facing percent display stays in the same "field guide" quiet register as everything else.
- **Anchor references**: `/moderate`'s existing alias/husbandry-product review sections (dense list + inline edit, no modal-per-item) for the entry UI; the existing `ElementColorKey` swatch-plus-label pattern for display, just appending a percentage.

## 4. Scope

- **Fidelity**: production-ready.
- **Breadth**: four surfaces — (a) a new moderator color-entry UI, (b) wiki morph page percent display, (c) identify-funnel percent display for the AI-guess path, (d) `scoreCoralMatch` ranking change. This is the largest of the recent shaped passes — expect it to be built as several sequential commits, not one, following the same "shape once, build in stages" pattern already used for the callout engine and onboarding journey.
- **Interactivity**: moderator UI is a standard server-action form (mutations via `app/moderate/actions.ts`, matching the existing alias/product approve/reject pattern); wiki/funnel display is server-rendered, no new client state.
- **Time intent**: ship-quality for all four parts; no throwaway prototyping.

## 5. Layout Strategy

### 5a. Moderator color-entry UI (net-new — no prior art in this product)

New section on `/moderate` (reusing its existing collapsible-section IA alongside Aliases / Husbandry Products / Reported Comments), or a dedicated `/moderate/colors` route if the page is already getting crowded — **default to a new section on the existing page** unless it proves unwieldy once built, since introducing a second moderation entry point is its own IA decision better made after seeing the real thing.

Flow: **search a taxon** (reuse the exact search-as-you-type pattern from `QuickAddSpecimen`/header search against `getAllMorphsForSearch()`) → selecting one shows its current `color_ranges` as an editable list (each row: position label dropdown, pattern dropdown, label text, hex stops with a color swatch preview, percent number input, lighting-condition dropdown) → **Add a color** appends a blank row → **Save** persists via a new server action. Deleting a row needs its own confirm (mirrors the reset-grid pattern: a destructive action gets a plain-language confirm, not a bare click).

### 5b. Wiki morph page

`ElementColorKey` (`components/coral-ui.tsx`) already renders one line per color (position label, swatch, hex). Append the percent when present: `Orange face 80% #F28C00`. No percent shown when null (today's universal state) — exactly the same "omit, don't show a placeholder" rule already used elsewhere in this product (e.g. the dashboard card's equipment summary).

### 5c. Identify funnel

`funnel-result-families` (the small color-chip row per ranked result) gets the same quiet percent append when the AI-guessed or canonical percent is available for that family. This is display-only context — it doesn't change what's tappable.

## 6. Key States

| State | What renders |
|---|---|
| Moderator UI, taxon has 0 color_ranges | Empty list + "Add a color" button, no placeholder text needed (the empty list itself is self-explanatory next to the button) |
| Moderator UI, a color_range has no percent set | Percent field shows empty/blank, not "0" — 0% and "not recorded" are different facts and must stay distinguishable |
| Wiki page, percent present | Appended plainly: `Orange face — 80% · #F28C00` |
| Wiki page, percent absent (the current universal case) | Unchanged from today — no placeholder, no "not documented yet" noise added to a page that already has plenty of real content |
| Funnel result, AI guess included a percent for a matched family | Small percent shown next to that family chip |
| Funnel result, no percent data anywhere for that coral | Unchanged from today's chip-only display |
| Vision extraction returns a percent for a color the user *didn't* pick | Not shown as a ranking factor (only affects families the user actually selected — the funnel's colors-you-see step is still the source of truth for *which* colors matter to that search) |

## 7. Interaction Model

**Moderator entry**: standard form-per-row submission via server actions (`updateColorRange`, `addColorRange`, `deleteColorRange`, mirroring the existing `app/moderate/actions.ts` naming/shape). No client-side validation beyond what HTML5 number-input min/max already gives (0–100) — server re-validates against the same CHECK constraint the DB already enforces.

**Ranking nudge** (confirmed direction: boost when the user's picks include a coral's *dominant* color): extend `scoreCoralMatch` with an optional third input — the coral's per-family percent map (from canonical `approx_percent`, when present) — and add a small bonus (not a replacement of the existing coverage/precision formula) when the highest-percent family for that coral is among the user's matched families. Exact weight is an implementation detail to tune once real percent data exists for a handful of corals to test against (start conservative — a few percentage points, not enough to reorder a strong coverage match beneath a weak one).

**AI-guess wiring**: `PhotoTraitAssist`'s `onExtracted` callback currently only passes `families: ColorFamily[]` — extend it to also pass `approxPercents`, store it in `CoralIdentifyFunnel` state alongside `colors`, and feed it into the same ranking bonus path as canonical percent (ephemeral, this-session-only, never written to the database — unchanged from the existing "nothing from photo-assist is saved" contract).

## 8. Content Requirements

- Moderator UI labels: "Position" (dropdown, `element_types.code` values), "Pattern" (dropdown, `color_patterns.code` values — Solid/Range/Rainbow/Banded/Spotted/Mottled/Tipped/Ringed), "Label" (free text, e.g. "Orange face"), "Hex" (per stop, with a live swatch preview), "% of coral" (number, 0–100, optional), "Lighting" (dropdown: Daylight/Actinic/Mixed/Unsure, optional).
- Wiki/funnel percent display: plain `N%`, no decimals (percent is always described as "rough"/"approximate" in the schema's own comment — don't imply false precision with `82.5%`).
- No new error-message copy needed beyond the existing form-error patterns already used elsewhere (`<p className="error">`).

## 9. Recommended References

- `reference/clarify.md` — worth a pass on the moderator form's field labels once built (this is genuinely new admin vocabulary with no existing precedent to match).
- `reference/harden.md` — the moderator UI is a new mutation surface touching canonical public data; worth a deliberate look at authorization (must confirm `is_moderator` gate, matching the existing `/moderate` page's check) and input validation before considering it done.

## 10. Open Questions (asserted defaults, not blocking)

- **Exact ranking bonus weight**: asserted as "small, conservative, tune later" — not a fixed number yet; real percent data doesn't exist for any coral today, so tuning against real cases has to wait until at least a few are entered.
- **`/moderate` new section vs. new route**: asserted as a new section on the existing page first; revisit only if the page gets unwieldy.
- **Whether the moderator UI also lets a moderator create/delete a taxon's colors from scratch (not just edit existing rows)**: assumed yes — "Add a color" must work for a taxon with zero existing rows, since most of the 101 seed corals will need their first-ever moderator-entered data through this exact path (compounding with the separately-flagged seed-accuracy research task).

---

**Anti-goals**: not a bulk-import tool (one taxon at a time, matching the product's "reference database" register, not a spreadsheet upload); not a change to the funnel's own color-picker UI (users still just tap which colors they see — percent is never asked of the *user*, only ever sourced from a moderator or the AI guess); not a full CMS for taxon data generally (scoped strictly to color_ranges/color_stops, not names/care difficulty/growth form/etc., even though a real admin UI might eventually want all of that).
