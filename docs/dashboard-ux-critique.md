# Dashboard Flow — Critical UX Audit

*Written 2026-07-16. Method: single-context sequential (design review first, then deterministic detector) — flagged per the impeccable critique protocol as `⚠️ DEGRADED: single-context (harness restricts sub-agent spawning; user requested credit-conserving incremental work)`. Sections are written as they complete so progress survives an interrupted session.*

**Scope**: the logged-in flow — `/dashboard` → create tank → `/tank/[id]` → grid → `/tank/[id]/husbandry` → `/specimen/[id]` — critiqued against the product's own stated purpose (PRODUCT.md): *"The tank grid, specimen tracking, and photo logging exist to build a crowdsourced dataset linking a coral's actual coloration to the real conditions that produced it."*

---

## Section 1 — The flow as built, and where it breaks ✅ COMPLETE

### 1.1 Flow map (as-built)

```
/dashboard ("Your tanks")
 ├─ per-tank card: 5-row param log + param graph buttons + 5-field logging form
 ├─ "Add a tank" form (11 fields, incl. optional grid setup)
 ├─ wishlist table
 └─ tank name (plain link in h2) ──► /tank/[id]
                                      ├─ muted subtitle line: "Mixed · 75 gal · Equipment & dosing" ──► /tank/[id]/husbandry
                                      ├─ grid (or one-shot ConfigureGridForm)
                                      ├─ Reset grid
                                      └─ Unplaced specimens + QuickAdd ──► /specimen/[id]
                                                                            ├─ placement (move/remove)
                                                                            └─ edit (name/date/photo)
Photo logging lives elsewhere: /coral/[genus]/[morph] "Keep track of yours" → upload, stamped
with a parameter snapshot (computeParameterSnapshot, per-param 50-reading lookback).
```

### 1.2 Structural findings (each confirmed in code, not just impression)

**F1 — The tank link has no affordance. [P1]** `dashboard/page.tsx:159` renders the tank name as a bare `<a>` inside the card's `<h2>`. `globals.css:43-48` sets `text-decoration: none` on links, underline on `:hover` only — which doesn't exist on the primary device (phone, per PRODUCT.md). Color is the only signal, and the h2 sits directly above a table and a form that absorb all attention. Worse, the card *feels complete* — it shows data AND accepts input — so nothing suggests there's a deeper page at all. The dashboard card is a destination, not a doorway. **User's complaint #1 is structural, not cosmetic.**

**F2 — Nothing routes you after tank creation. [P1]** `createTank` (`dashboard/actions.ts`) ends with `revalidatePath("/dashboard")`. You fill 11 fields, press Create, and… the page you're already on re-renders with one more card. No redirect to `/tank/[id]`, no "now add your corals," no acknowledgment. The single most motivated moment in the funnel (new user, new tank, ready to invest) lands on silence. Combined with F1, a new user may *never discover the tank page exists*.

**F3 — "Equipment & dosing" is disguised as metadata. [P1]** `tank/[id]/page.tsx:160-165`: the husbandry link is an inline text link inside a `muted`-class paragraph, sandwiched between "75 gal" and nothing, directly under the h1. It reads as subtitle chrome, exactly where the eye skips. This is the only route to equipment/dosing in the entire app. **User's complaint #2 confirmed** — and it's worse than placement: there is no signal anywhere on the dashboard that equipment logging exists at all.

**F4 — Equipment logging is write-only. The promised benefit doesn't render anywhere. [P0 against the product's own goal]** The husbandry page's own copy promises: *"it stays linked to whenever a coral was photographed or confirmed while it was running."* In code, that link does not exist: `computeParameterSnapshot` (`lib/photo-upload.ts`) snapshots only the 5 water columns. Equipment is joinable to photos only implicitly (installed_on/removed_on vs taken_at) and **no page performs that join** — not the photo drawer, not the specimen page, not the morph page. A user who dutifully logs their AI Prime and 2-part dosing gets *zero* rendered payoff: no tank-page summary, no photo stamp, no comparison, nothing. This is the root cause of "I want the site to feel like there's a benefit to logging equipment" — currently there objectively isn't one.

**F5 — Recommended vs. actual are never compared. [P0 against the product's own goal]** The morph page shows recommended ranges (`param-strip`). The dashboard shows actual readings. The tank knows its specimens → specimens know their morph → morphs carry `rec_*` ranges + `light_level_code` + `flow_level_code`. Every ingredient for "your alk is 7.2 but your Walt Disney wants 8–9.5" and "this tank has no light logged but holds 3 high-light SPS" already exists in the database, and no surface crosses them. The user's equipment-callout idea isn't an add-on — it's the missing half of the core loop, derivable today with zero schema changes.

**F6 — Parameter data entry and the tank are split across pages. [P1]** All parameter logging/history lives on the dashboard card; the tank page has none of it — no latest readings, no log, no sparkline. So the "tank page" is really just the grid page, and the dashboard is four products in a trench coat (log viewer + logging form + tank factory + wishlist). The mid-task phone user PRODUCT.md describes ("checking a slot, logging a reading, snapping a photo") has those three actions scattered across three unconnected pages: reading → dashboard, slot → tank page, photo → wiki morph page.

**F7 — Photo logging is oriented around the wiki, not the tank. [P1]** To photograph *your own coral* you navigate to its public wiki page and use "Keep track of yours." From the tank grid — where you're standing when you take the photo — there is no "add photo to this specimen" path. The specimen page shows exactly one photo (representative) with no timeline, despite the dataset thesis being *coloration over time under known conditions*. The core loop's most valuable repeat action (re-photographing the same specimen as conditions change) has no home.

**F8 — `measured_at` can't be backdated. [P2]** `logParameters` stamps `new Date()`. Tested at 7am, logged at 9pm = 14-hour lie in a dataset whose photo snapshots join on `measured_at ≤ taken_at`. One optional datetime field fixes it.

**F9 — Tank creation asks 11 questions, the wrong way. [P2]**
- `tank_type` is **free text** (placeholder "Mixed / SPS / Frag") in a product whose whole pitch is structured data. It can never power "compare SPS tanks" or seed default targets. Should be an enum — and it could *drive* smart defaults (SPS tank → tighter target bands later).
- Grid setup (cols/rows/tiers) duplicates the tank page's ConfigureGridForm, but without the tier SVG explainer that makes tiers comprehensible there. Two UIs for the same job, the harder one shown first, at the moment of least understanding.
- L/W/H are asked upfront but drive nothing visible anywhere.

**F10 — Sign-out is the dashboard's top-right primary position. [P3]** The most prominent header-adjacent action on the main logged-in page is *leaving*. The wishlist — a browse-mode feature — also outranks any coral/specimen presence on the dashboard, which shows zero corals. Your tanks' *inhabitants* never appear on "Your tanks."

### 1.3 The one-sentence diagnosis

The app currently has the **skeleton of a data platform wired like a set of disconnected admin forms**: every logging surface exists, but no surface ever *pays the user back* — data goes in on three different pages and never comes back out where the next decision is being made (at the tank, at the specimen, at the photo).

---
## Section 2 — Live walkthrough: signup → create tank → enter tank ✅ COMPLETE

*Tested live at 375×812 (PRODUCT.md's primary persona is a phone next to the tank), throwaway account `uxtest0716`, real dev server against the live DB.*

**L1 — Post-signup, the header still says "Log in." [P2]** Immediately after signup you land on `/dashboard` reading "Signed in as uxtest0716" while the top nav shows **Log in**. It corrects on the next navigation. First impression of a data-trust product is an auth contradiction. (The 2026-07-10 header-auth fix covered navigation staleness, not the post-signup landing.)

**L2 — The new-user dashboard is a tax form. [P1]** Empty state = one line of copy ("No tanks yet — create your first one below") then 11 input fields. No why, no picture of what a set-up tank looks like, no "this takes 30 seconds." The signup page bothers to explain *why* it asks for zip; the tank form explains nothing. First-timer Jordan fills Name and stares at Length/Width/Height wondering if they need a tape measure. **Minimum viable ask is one field: Name.** Everything else is editable later (in fact volume/type/dimensions currently aren't editable later — there's no tank-edit form at all, a separate gap).

**L3 — Mobile layout of the creation form is broken. [P2]** At 375px the Type/Volume/Established row renders a ~110px Type input with its placeholder truncated to "Mixe", a Volume input vertically misaligned with its neighbors (two-line label), and a full-width Established underneath. The `.row` grid doesn't wrap to single column on narrow screens.

**L4 — Post-create: silence, and a second identical form. [P1 — F2 confirmed live]** After Create you're returned to the dashboard mid-scroll: new card above, *the same empty "Add a tank" form below*. No success signal, no route into the tank, no "next: add corals / set up equipment." The empty form invites accidental double-creation. The grid you just configured (4×3×2) is completely invisible on the dashboard card — nothing says the tank *has* a grid, which buries the reward for having configured it.

**L5 — The tank card reads as a destination, not a doorway. [P1 — F1 confirmed live]** The card gives you a log table and a logging form — a complete-feeling widget. "UX Test Reef" is blue (deep-water-blue), but un-underlined, next to muted metadata, on a device with no hover. Nothing on the card says "open tank," "grid," "corals," or shows a chevron. A user who never taps the name never learns the rest of the product exists.

**L6 — Parameter logging works but is feedback-free and can't be backdated. [P2 — F8 confirmed live]** Logged Alk 8.2 + Ca 420: row appears with dashes for the rest (good honesty), but there's no confirmation moment, and `measured_at` was stamped 7:49 PM — the moment of *data entry*, not measurement, with no way to correct it.

**L7 — The five parameter inputs have no accessible names. [P2, WCAG]** Labels aren't programmatically associated (`label` without `htmlFor` / input `id`). Screen reader: five anonymous spinbuttons. Same pattern in the Add-a-tank "row" groups.

**L8 — THE GRID OVERFLOWS THE PAGE BODY ON MOBILE. [P1]** On `/tank/[id]` at 375px with 4 columns, column D is clipped mid-word ("Empt…") and the **entire page** scrolls horizontally — header, title, everything drags sideways (no `overflow-x: auto` container around the grid). No affordance hints that more columns exist. At 6+ columns (any large tank) the page becomes a floaty horizontal mess. The grid needs its own scroll container — or better, a mobile rendering that fits (see Section 5).

Verdict on the create→enter seam: **the product's front door opens into its least valuable room, and the door to the most valuable room is painted like the wallpaper.**

---
## Section 3 — Grid interactions + equipment/dosing discoverability ✅ COMPLETE

*Live-tested: tier switching, empty-cell taps, quick-add end-to-end (Rasta Zoanthid → nickname "Test Rasta" → slot B2·L1), reset-grid confirm, husbandry page + real light logged (AI Prime 16HD).*

### The grid — "ok" is about right, and here's precisely where it stops being ok

**G1 — Empty cells look tappable and aren't. [P1]** Every empty cell is a bordered, rounded, card-styled box — the strongest "button" visual on the page — and tapping one does nothing (it's a `<span>`). The single most natural interaction ("put a coral in *this* slot") is dead. All adding happens through "+ Add a coral" *below* the grid, under the jargon heading "Unplaced specimens."

**G2 — Placement is a 24-option flat dropdown speaking a different language than the grid. [P1]** The quick-add slot picker lists `A1 · L1 … D3 · L2` — 24 flat options for a small 4×3×2 tank (a 8×4×3 tank would produce 96). Meanwhile the grid on screen labels cells `A1` and calls layers **"Tier 1 / Tier 2"** — the dropdown says **"L1/L2."** Two vocabularies for the same concept, and the user must mentally translate a *visual* position into a *text* row. The fix and the G1 fix are the same feature: tap-to-place.

**G3 — Tier UX: works, under-explained, defaults oddly.** The tier rail + SVG band is a genuinely good idea (the band correctly highlights the bottom slice for Tier 1) — but it opens on the *top* tier (`useState(tierCount)`), the physical stacking order of the buttons (Tier 2 above Tier 1) is never explained, nothing says what a tier *is*, and if you quick-add into a tier you're not currently viewing, the coral lands invisibly with zero feedback about which tier it went to.

**G4 — Reset grid sits directly under the tier buttons, front-row on the page. [P2]** A destructive, no-undo action (its own confirm copy suggests *screenshotting the grid* as a backup strategy — an honest admission there's no undo) placed adjacent to the most-tapped control on the page, always visible, even on an empty grid. During testing, one coordinate drift landed a tap on it — a real thumb will do the same. Belongs behind a settings/overflow affordance, with typed-confirmation if the grid is non-empty.

**G5 — Empty grid = 24 × "Empty". [P2]** The empty state repeats the word "Empty" once per cell and says nothing about what the grid is for or that cells will hold photos/corals. First-use moment teaches nothing (a product-register empty state should teach the interface). Also "Everything in this tank is placed in the grid" renders for a tank with *zero* corals — a false-positive message wording.

**G6 — (From Section 2, re-confirmed) the grid overflows the page body horizontally on mobile with no scroll container.** This plus G1/G2 means on the primary device the grid is simultaneously the page's centerpiece and its least usable element.

**What's genuinely good:** the three-door quick-add fork (known coral / private label / propose-to-community) is excellent product thinking — it absorbs taxonomy uncertainty without blocking the user, and search-as-you-type against the wiki felt instant. Placed coral renders its nickname in the cell immediately. This flow deserves a first-class mobile treatment; it's currently hidden behind the least attractive section of the page.

### Equipment & dosing — a good page nobody will ever find

**H1 — The only entrance is a muted inline link. [P1 — user's complaint #2, live-confirmed]** "Mixed · 75 gal · **Equipment & dosing**" — the sole route to the whole husbandry subsystem is styled as part of the tank's metadata subtitle. It's blue, but it sits in a `muted` line at subtitle size; it reads as a tag, not a place. Nothing on the dashboard hints the feature exists. A user could log parameters for a year and never learn the app tracks equipment.

**H2 — The page itself is well-structured** (Flow / Light / per-element dosing drawers / additives, honest empty states, "Duplicate this light →" for multi-fixture tanks, remove-preserves-history). Logging a real light took ~20 seconds. The *form* isn't the problem — the *placement and the payoff* are.

**H3 — The payoff is zero, live-confirmed. [P0 — same root as F4]** After logging the AI Prime 16HD: tank page — no mention; dashboard — no mention; nothing anywhere else in the app will ever render it. The page's own header copy promises photo-linkage that no surface implements. Every minute spent here is, from the user's viewpoint, thrown into a void. **This, not the link styling, is why husbandry feels buried: the product gives you no reason to have gone there.**

**H4 — Small frictions**: light "Placement (slot #)" reuses grid-slot vocabulary for a fixture that hangs *above* the tank (should be "which end/section does it cover"); brand/model are free text with no product registry (dosing products got a registry + moderation pipeline; equipment didn't — so "AI Prime", "ai prime 16", "Aqua Illumination Prime" will fragment the future dataset the same way `tank_type` free-text does).

**H5 — Transient auth bounce. [P2, reliability]** Once during testing, navigating to the husbandry URL bounced to `/login` while the header simultaneously showed "Sign out" (session was valid; retry worked). An intermittent mid-session "log in again" moment in a logging product is a trust leak — worth investigating the @supabase/ssr token-refresh path before it hits real users mid-entry.

---
## Section 4 — The value loop: does logging pay the user back? ✅ COMPLETE

The product's dataset thesis needs four inputs per photo: **coloration (photo) + water (params) + light + time**. Trace of where each logged datum ever resurfaces:

| You log… | Where it comes back | Verdict |
|---|---|---|
| Parameter reading | Dashboard card log (5 rows) + graph modal. Photo snapshots (if you upload via wiki with a tank selected). | Comes back *on the page you typed it into*, nowhere else. Never compared to anything. |
| Equipment (flow/light) | **Nowhere.** Not tank page, not dashboard, not photos, not specimen. | Write-only. (H3, live-confirmed.) |
| Dosing methods / additives | **Nowhere** outside the husbandry page itself. | Write-only. |
| Specimen + placement | Grid cell + specimen page. | Static record; no history, no photo timeline. |
| Photo | Wiki morph page gallery + param drawer. | Community-facing only; your own coral's photos have no per-specimen timeline view. |
| Tank dimensions (L/W/H) | **Nowhere.** | Write-only. |

**V1 — Even logged-in ownership is invisible. [P1]** Tested live: signed in, owning a Rasta Zoanthid ("Test Rasta", slot B2, tank alk 8.2 logged minutes prior), the Rasta wiki page shows generic recommended ranges (7–10 dKH) with zero awareness that (a) I keep this coral, (b) where it is, (c) how my actual water compares — while offering "+ Add to my collection," a path to accidentally double-add. The IMDb-register design principle ("dense, cross-linked entity pages") is violated in the one direction that monetizes the user's own data.

**V2 — The dataset's most color-determining variable isn't captured. [P1, strategic]** PRODUCT.md's own reference (World Wide Corals daylight/actinic side-by-side) names lighting as the thing that changes apparent color. The schema grew `color_ranges.lighting_condition` (2026-07-14), and the identify flow's vision model already *detects* actinic lighting — but the photo-upload flow never asks and `coral_photos` never stores what light a user photo was taken under, and the logged light fixture (H3) is never joined to the photo either. Every community photo enters the coloration dataset lighting-blind.

**V3 — No comparison, no trend, no nudge.** The three cheapest payback mechanisms for a logging product — "you're in/out of range," "this is drifting," "you haven't logged in N days" — all absent. The graph modal is the only trend surface and it renders raw values with no target band overlay, even though targets are one join away.

### Heuristic score (Nielsen, 0–4 each — flow-scoped, not whole-site)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | No post-create/post-log confirmation; stale "Log in" header after signup; invisible tier placement |
| 2 | Match system/real world | 2 | "Unplaced specimens," "L1" vs "Tier 1," slot-# for lights; params/ranges themselves speak fluent reef-keeper |
| 3 | User control & freedom | 2 | Reset-grid confirm is good; but no undo anywhere, no tank edit/delete, one-shot grid config |
| 4 | Consistency & standards | 2 | Two add-coral paths with different vocab; two grid-config UIs; dosing gets a product registry, equipment doesn't |
| 5 | Error prevention | 2 | Reset confirm yes; but double-create invite (L4), double-add path (V1), free-text type field |
| 6 | Recognition over recall | 1 | Slot dropdown demands recall of visual positions; husbandry link camouflaged; features undiscoverable from dashboard |
| 7 | Flexibility & efficiency | 2 | Quick-add fork is genuinely efficient; no backdating, no bulk ops, no keyboard path |
| 8 | Aesthetic & minimalist | 3 | Clean, quiet, on-register; detector: 0 banned patterns, 7 advisory font-size literals |
| 9 | Error recovery | 2 | Server actions fail silently (no error surface on dashboard forms); transient /login bounce with contradictory header |
| 10 | Help & documentation | 1 | Zip-field explainer shows the register exists; nothing else explains tiers, grid, or why to log |
| | **Total** | **19/40** | **Poor→Acceptable boundary: core experience works but doesn't teach, pay back, or connect** |

**Anti-pattern verdict**: This does *not* look AI-slop-generated — it looks like an engineer's admin UI: clean tokens, honest copy, zero decorative junk (detector agrees: nothing but advisory font-size drift). The failure register is the opposite of slop: **under-designed connective tissue** — pages built feature-by-feature, each correct in isolation, none aware of the others.

**Personas** — Casey (distracted mobile, PRIMARY): body-scroll grid, dead cells, no state feedback = abandons placement; logs params on dashboard fine. Jordan (first-timer): survives signup; stalls at 11-field tank form; never finds husbandry; never learns what a tier is. Alex (power user): no backdating, no bulk placement, no keyboard nav, one-at-a-time dropdown placement; would live in a spreadsheet instead.

---

## Section 5 — Synthesis: what to build, in order ✅ COMPLETE

### The organizing insight

Every complaint in this audit reduces to one sentence: **data flows in but never flows back out where decisions happen.** Fixing navigation without fixing payback would polish the doors of empty rooms. The recommendation order below therefore puts the payback engine first — it's also the piece the vendor future-state reuses wholesale.

### P0 — "Close the loop" (the callout engine — yes to your callout idea, and it's the keystone)

1. **Build a pure requirements-aggregation function** (`lib/tank-callouts.ts`): given a tank's specimens → their morphs (with genus fallbacks, already implemented in `withGenusCareDefaults`) → aggregate needs: per-parameter tightest band (max of mins / min of maxes), highest light tier demanded, highest flow tier demanded. Compare against: latest readings, logged light/flow equipment, configured dosing. Output typed callouts:
   - `param_out_of_range`: "Alk 7.2 — below the 8–9.5 dKH your 3 SPS corals want" (link: log parameters)
   - `equipment_gap`: "3 high-light corals · no light logged" (link: husbandry page)
   - `stale_data`: "No reading in 14 days — snapshots for new photos will be stale"
   - `conflict` (bonus, high trust-value): "Rainbow Trachy prefers ≤5 ppm nitrate; your zoas prefer ≥2 — mixed tank, aim 2–5"
   Tone per PRODUCT.md: field-guide-calm, one line, never red-alarm. **This single feature makes equipment logging worth it** — the gap callout appears, you log the light, it resolves. Behavior → reward.
2. **Tank Status header on `/tank/[id]`**: latest 5 params as chips with in/target/no-data states + the callouts + one-line equipment summary ("AI Prime 16HD · 2 pumps · 2-part dosing" or "Nothing logged yet →"). The tank page becomes the *decision* page, which retroactively justifies entering it.
3. **Dashboard card → doorway**: replace bare-link title with a real "Open tank →" affordance; show grid occupancy ("9/24 placed"), coral count, worst-callout badge ("1 callout"), and an explicit Equipment & dosing link. Card keeps quick param logging (it's good there — lowest friction wins).
4. **Post-create routing**: `createTank` redirects to `/tank/[id]`, which (for an empty tank) shows a 3-step checklist empty state: *Add your corals → Set up the grid → Log equipment & dosing.* Kills L4, F2, and the husbandry-discoverability problem in one stroke.

### P1 — Grid, mobile, photos

5. **Tap-to-place**: empty grid cells open quick-add (or a place-here picker for existing unplaced specimens) with the slot pre-selected. Delete the 24-option dropdown. Unify vocabulary on **Tier** everywhere (kill "L1/L2" labels). Give the grid `overflow-x: auto` on its own container as the floor fix; better, fit columns to viewport per tier on mobile.
6. **Demote Reset grid** to an overflow/settings menu on the tank page; keep the confirm, add a typed confirmation when ≥1 specimen is placed.
7. **Specimen photo timeline + tank-context photo logging**: "Add photo" on the specimen page and grid cell (camera-first on mobile), reusing `uploadCoralPhoto`'s existing auto-specimen linkage; specimen page renders its own photos newest-first with their parameter snapshots. This is the "coloration over time under known conditions" product moment.
8. **Capture lighting per photo** (`coral_photos.lighting_condition`, one small migration): one 4-chip question at upload (Daylight / Actinic / Mixed / Not sure), pre-fillable later by the existing vision extractor. Without it the coloration dataset stays lighting-blind (V2).

### P2 — Form and data quality

9. `tank_type` → enum select (Mixed/SPS-dominant/LPS-dominant/Softy/Frag/FOWLR); one-field tank creation (Name) with "add details" disclosure; optional backdate field on parameter logging; associate every label with its input (`htmlFor`/`id`) — this also fixes the WCAG miss; error surfaces for failed server actions.
10. Equipment brand/model registry (mirror the dosing-products pattern) — prevents dataset fragmentation before equipment-derived insights (future-considerations Idea 2) need clean joins.

### The store/vendor future state (asked, answered, deliberately not built now)

Two distinct vendor surfaces; only one exists:
- **Listings management** (`/business`) — exists, photo-first, fine for now.
- **In-store consult mode** — the real add-on later: a store employee with a customer pulls up *the customer's tank* and asks "will this coral thrive in it?" That is **exactly the P0 callout engine** run against a prospective coral instead of a housed one ("your alk band fits · your light is sufficient · flow is below this SPS's preference"). Build the engine as a pure function now (no auth assumptions, tank-shaped input), and the consult mode later is UI + a customer-lookup permission model (schema already stubs `businesses`/`business_members`). Don't build any of the consult UI yet — but don't bury the engine inside a React component either.

**Sequencing rationale**: P0 makes existing logging valuable (retention), P1 makes the primary device usable (activation), P2 makes the dataset clean (the long game). The vendor consult mode falls out of P0 nearly free.

### Suggested next commands
- `/impeccable shape` the Tank Status header + callout engine (P0.1–2) — it's a real feature, worth a shaping pass before code.
- `/impeccable onboard` the create-tank → first-coral journey (P0.4).
- `/impeccable adapt` the tank grid for mobile (P1.5–6).

---
*Detector (Assessment B): 7 findings, all advisory `design-system-font-size` (0.8/0.85rem literals in husbandry sections + parameter-graph-button); zero banned anti-patterns; no false positives worth noting. Browser overlay injection intentionally skipped: findings were advisory-only and the user asked for credit conservation.*
*Test data cleanup: throwaway `uxtest0716` account, tank, specimen, reading, and light were deleted from the live DB and verified gone (0 rows).*

## Post-critique decisions (user, 2026-07-16)

1. **Build order**: Close the loop first (callout engine + tank status header + card-as-doorway + post-create routing). Grid/mobile work after.
2. **Callout tone**: calm advisory — quiet one-line chips in the tank header, field-guide voice, link to fix. Not dashboard-level warning badges.
3. **Lighting capture**: user is aligned in principle but flagged that "daylight vs actinic" is too coarse — modern LEDs are tunable multi-channel, profiles like AB+ exist, and ramp position (time of day) changes everything; a spectrum-level standard "will never happen." **Agreed design**: capture the *perceptual* appearance, not the spectrum — one required tap at upload ("Mostly blue / Blended / Mostly white / Not sure", mapping onto the existing `lighting_condition` enum for vocabulary consistency), plus *derived* precision with zero extra questions: join photo `taken_at` time-of-day against the tank's already-logged light fixture + ramp mode + peak hours. Optional profile name (e.g. "AB+") lives on the light fixture in husbandry (asked once per fixture), never per photo.

4. **Lighting precision mode: dropped.** The physical-reference-card "precision mode" (real color correction via a known-value patch in frame) was considered and rejected — the friction of asking users to keep/place a reference card isn't justified without automatic photo correction as the payoff, and automatic correction itself was ruled out (fluorescence is a re-emission process, not a reflectance color cast, so standard white-balance-style correction would confidently distort colors rather than fix them — a trust liability for an accuracy-branded product). The one-tap perceptual bucket (Mostly blue/Blended/Mostly white/Not sure) from decision 3 stands as the whole lighting-capture feature; a future automated classifier reading controller-app graph screenshots (per-brand template) to auto-fill that same bucket remains a nice-to-have, not scoped now.

## ✅ Shipped (2026-07-16): P0 item 1 — tank callout engine + status header

Built per [docs/tank-callout-engine-brief.md](tank-callout-engine-brief.md), all discovery decisions honored:

- **`web/lib/tank-callouts.ts`** — pure `buildTankStatus()` (unit-tested, `tank-callouts.test.ts`, 9 tests: shared-band outlier, genuine-conflict outlier naming the specific coral, equipment-gap presence-only logic, low-demand-tier suppression, empty/excluded-specimen cases) + `getTankStatus()` data loader (specimens → taxon-linked morphs only → genus-fallback via newly-exported `withGenusCareDefaults` → parameter intersection/conflict math → equipment presence check).
- **`web/components/tank-status-block.tsx`** — renders on `/tank/[id]` between the subtitle and the grid: a neutral "Last logged: … · Xh ago" line, plus calm-advisory chips (equipment-gap chips ordered before parameter-outlier chips, per the brief). Zero callouts renders silence, not a green checkmark — the confirmed "quiet all-clear" design.
- **Live-verified end-to-end** (throwaway account/tank, cleaned up after, 0 rows confirmed): empty-tank onboarding line; equipment-gap chips firing for both light and flow, then each clearing independently as equipment was logged; a shared-band parameter outlier (Alk 7.2 vs. the SPS coral's 8–9.5 dKH band); the fully-quiet all-clear state once everything resolved. One real bug caught and fixed during this pass: the non-interactive outlier `<span>` was rendering in the same accent-blue as real links, implying false clickability — split into distinct `.tank-callout` (neutral text) vs. `.tank-callout a` (accent) CSS.
- **Typecheck/lint clean** across all touched files; project-wide `vitest` run 50/50 passing; impeccable `detect.mjs` found zero anti-patterns in the new files.
- **Not built in this pass** (explicitly out of scope per the brief): dashboard-card rebuild, post-create routing, grid mobile fixes, stale-reading chip — all still pending from the original Section 5 recommendations.
- **Spun off, not fixed here**: `parameter_readings.temperature_c` exists in the schema and every coral's wiki page shows a recommended temperature range, but the dashboard's logging form never collected it — flagged as a separate background task (not silently added, since it's outside this feature's scope) rather than fixed inline.

## ✅ Shipped (2026-07-17): create→first-coral journey (onboard)

Built per [docs/onboard-first-coral-journey-brief.md](onboard-first-coral-journey-brief.md), fixing F1/F2/F3 at the root:

- **`createTank` now redirects** to `/tank/[id]` on every successful creation (not just the first) — no more landing back on a re-rendered dashboard with an empty form still showing.
- **`web/components/onboarding-checklist.tsx`** — a plain 3-item list ("Grid configured" / "Add your first coral" / "Log your equipment →"), mutually exclusive with the callout engine's `TankStatusBlock` in the same page slot. Only renders once a grid exists (the app's own quick-add flow requires one first), so "Grid configured" always shows pre-checked when the checklist appears — listed anyway so progress reads honestly against the confirmed 3-step gate. Fades permanently once all 3 conditions are true (≥1 specimen, grid configured, ≥1 equipment row — via the callout engine's new `equipmentLogged` flag), replaced by the real status block from then on.
- **Dashboard card rebuilt as a doorway**: "Open <Tank Name> →" (full-height tappable link, not color-only text) + a callout-count badge, then a one-line occupancy/equipment summary ("0/6 placed · AI Prime 16HD"), with the existing param log/form unchanged underneath.
- **Live-verified end-to-end** (throwaway account, 2 tanks, cleaned up after): redirect confirmed on both a first and second tank creation; checklist rendered correctly with the grid item pre-checked; checklist correctly swapped to the status block the instant all 3 conditions were met (equipment logged last); dashboard card confirmed in all combinations — badge present, occupancy numeric, equipment summary present; badge absent + "No grid yet" for an ungridded coral-less tank.
- **One real bug caught and fixed via live screenshot, not just code review**: the card's callout badge crowded the title on mobile, wrapping the trailing "→" onto its own orphaned line. Fixed with a non-breaking `{" →"}` segment plus `flex-wrap` on the header so the badge drops to its own line instead of squeezing the title.
- Typecheck/lint clean, 50/50 tests passing, zero detector findings across all touched files.
- **Not built in this pass** (separately scoped, still pending): the tank-creation form's field count/enum work (F9), the grid's mobile overflow bug, and the stale post-signup header ("Log in" briefly shown right after a successful signup — pre-existing, unrelated to this feature).
