# Design Brief — Create → First-Coral Journey (Onboard)

*Shaped 2026-07-16/17, following the dashboard-flow critique ([dashboard-ux-critique.md](dashboard-ux-critique.md), F1/F2/F3, Section 5 items P0.3–4). Confirmed decisions from discovery folded in below.*

## 1. Feature Summary

The path from "press Create tank" to "have a coral placed and understood" currently has three structural holes: no redirect after creation (F2), a dashboard card that reads as a complete destination rather than a doorway (F1), and the husbandry link disguised as subtitle metadata (F3). This pass rebuilds that seam end-to-end: post-create redirect into the tank, a completion-gated onboarding checklist on the tank page, and a dashboard card rebuilt around "open the tank," not "everything already happened here."

## 2. Primary User Action

Immediately after creating a tank, understand *what to do next* without guessing — and from then on, the dashboard card should read as an invitation into the tank, not a self-contained widget that discourages clicking through.

## 3. Design Direction

- **Color strategy**: Restrained (unchanged from the callout-engine brief; same project default). The checklist and card doorway framing reuse existing tokens — no new hues.
- **Theme scene sentence**: same hobbyist-on-a-phone context as the callout brief — this is still a fast, low-ceremony glance, not a guided-tour modal experience. The checklist must never block or gate the rest of the page; it's a call-out block, not a wizard.
- **Anchor references**: same as the callout brief (Neptune Systems' plain-claims trust, IMDb/Metacritic dense entity pages for the dashboard card once rebuilt) — the checklist itself borrows from a plain numbered to-do list, not a progress-bar/gamified onboarding pattern (no confetti, no percentage bar — those would read as decoration in a "field guide, not a storefront" brand).

## 4. Scope

- **Fidelity**: production-ready.
- **Breadth**: three surfaces — `createTank`'s redirect target, a new checklist block on `/tank/[id]`, and a rebuild of the per-tank card on `/dashboard`. Does **not** touch the grid's mobile overflow bug or the tank-creation form's field count/enum work (both separately scoped, still pending).
- **Interactivity**: server-rendered, consistent with the rest of both pages. Redirect is a standard Next.js server-action redirect (`redirect()` after insert, same pattern already used for auth gates elsewhere in the codebase).
- **Time intent**: ship-quality.

## 5. Layout Strategy

**Post-create redirect**: `createTank` redirects to `/tank/[new-tank-id]` for every creation (confirmed — no first-tank-only special case). Simpler code path, consistent behavior, no special-casing to maintain.

**Checklist block** — sits exactly where the callout-engine's `TankStatusBlock` already sits (same slot, mutually exclusive with it — see Key States): a plain 3-item list, no progress bar, no percentage, each item either an unchecked bullet + link or a quietly checked-off state:

```
[Tank name — existing h1]
[Mixed · 75 gal · Equipment & dosing — existing subtitle]

Get this tank set up:
  ○ Add your first coral         (link scrolls to / opens quick-add)
  ○ Set up the grid              (link — or auto-hidden if ConfigureGridForm is already showing)
  ○ Log your equipment           (link → /tank/[id]/husbandry)

[Grid — existing, or ConfigureGridForm if not yet set up]
```

Once all 3 conditions are met (≥1 specimen placed *or* even just existing in the tank — see Key States for the exact predicate, grid configured, ≥1 equipment row logged), this block is replaced by the callout-engine's `TankStatusBlock` — they occupy the same visual slot and are mutually exclusive, never both shown.

**Dashboard card hierarchy** (confirmed: name+badge → occupancy → params, top to bottom):

```
[Open <Tank Name> →]  [2 callouts]        ← doorway title + callout-count badge (from tank-callouts engine)
9/24 placed · AI Prime 16HD · 2 pumps     ← one-line occupancy + equipment summary
[existing param log table]
[existing quick-log form]
```

The existing param log/form stay exactly as they are today, just demoted beneath the new doorway header — per critique Section 5's reasoning, the fast param-logging path shouldn't get slower, only the framing above it changes.

## 6. Key States

| State | What renders |
|---|---|
| Tank just created (0 specimens, no grid, no equipment) | Redirected here immediately. Checklist shows all 3 items unchecked. `ConfigureGridForm` (existing one-shot grid setup) still renders below, since a grid is one of the 3 checklist items and the tank has no grid yet. |
| 1 or 2 of 3 conditions met | Checklist shows a mix of checked/unchecked items; still no `TankStatusBlock`. |
| All 3 conditions met (confirmed gate: ≥1 specimen AND grid configured AND ≥1 equipment row) | Checklist disappears permanently (no re-appearance if the user later removes their only coral — this is an onboarding nudge, not a persistent status; the callout engine already covers ongoing status once onboarding is done) — `TankStatusBlock` renders in its place from then on. |
| Dashboard card, tank with 0 corals | "0/N placed" (or "No grid yet" if ungridded) · no equipment summary segment if nothing logged · no callout badge (nothing to call out yet — consistent with the callout engine's own quiet-empty-state rule). |
| Dashboard card, tank with active callouts | Badge shows the count only (e.g. "2 callouts"), not the content — content lives on the tank page itself; keeps the card scannable across multiple tanks. |
| Dashboard card, tank fully clear | No badge at all — silence is still the all-clear signal, consistent with the callout engine's own tone. |

## 7. Interaction Model

- `createTank` server action: after the existing insert + optional grid-slot bulk-insert, call `redirect(`/tank/${tank.id}`)` instead of (or in addition to, redundantly) `revalidatePath("/dashboard")` — redirect implies the destination revalidates on load, so the explicit revalidate call likely becomes unnecessary, but verify Next 16's actual redirect+cache-invalidation behavior in this codebase (per `web/AGENTS.md`'s warning) before assuming standard behavior.
- Checklist items are plain links: "Add your first coral" scrolls to / opens the existing `QuickAddSpecimen` control (reuse, don't duplicate); "Set up the grid" is only shown as a checklist item text when a grid already exists further down the page in collapsed form — when no grid exists yet, don't show a redundant "set up the grid" link above the `ConfigureGridForm` that's already rendering below it (avoid saying the same thing twice on one page).
- Dashboard card's "Open <Tank Name> →" is the single clear entry point — full-width or at least full-line tap target on mobile, not just the name text (fixes F1's core complaint: color-only affordance with no target size).
- No client-side JS required for any of this; all three conditions (specimen/grid/equipment presence) are simple existence checks alongside data the tank page and dashboard already fetch.

## 8. Content Requirements

Checklist copy, plain and specific, no exclamation points (same tone contract as the callout engine):
- `"Get this tank set up:"` (header, not a question, not "Let's get started!")
- `"Add your first coral"` / `"✓ 1 coral placed"` (or similar quiet checked-state copy — avoid a literal checkmark-heavy gamified look; a simple strikethrough or de-emphasized muted line is more consistent with DESIGN.md's restraint than a green check icon)
- `"Set up the grid"` / omitted once done (grid form itself disappearing is already the existing "done" signal — no separate checklist copy needed once it exists)
- `"Log your equipment"` / `"✓ Equipment logged"`

Dashboard card:
- `"Open <Tank Name> →"`
- `"9/24 placed"` or `"No grid yet"` if ungridded
- Equipment summary: `"AI Prime 16HD · 2 pumps"` or omitted if nothing logged (don't show "Nothing logged" as dead weight on every card — omission is enough)
- Badge: `"N callout" / "N callouts"` or nothing

## 9. Recommended References

- `reference/onboard.md` (this command's own reference — already the operating frame).
- `reference/clarify.md` — a copy pass on the checklist item labels once built, same reasoning as the callout-engine brief.
- No `layout.md`/`typeset.md` expected — reusing existing card/list patterns, no new type scale or grid system.

## 10. Open Questions (asserted defaults, not blocking)

- **Exact specimen-count predicate for "coral added"**: assert "≥1 specimen row exists for this tank, placed or unplaced" (not "≥1 *placed* in a grid slot") — a coral quick-added but not yet slotted still represents real onboarding progress; don't force grid-placement into the coral-added condition when grid setup is already tracked as its own separate condition.
- **Checklist re-appearance**: asserted as one-time/non-persistent (see Key States) — if this turns out wrong in practice (e.g. a user deletes their only coral and finds the checklist gone forever, confusingly), revisit; not treating this as a blocking risk since the callout engine's ongoing status naturally fills that gap afterward.
- **Redirect + existing `revalidatePath("/dashboard")` interaction**: flagged as needing a quick check against this project's actual Next.js 16 behavior (per `web/AGENTS.md`) rather than assumed — implementation should verify, not guess.

---

**Anti-goals**: not a modal/wizard-style onboarding flow (checklist is inline, dismissible-by-completion only, never blocks the rest of the page); not a gamified progress bar or percentage; not a redesign of the tank-creation form itself (still 11 fields today — that's separately scoped per the critique's F9); not a fix for the grid's mobile overflow (separately scoped, still pending).
