---
target: tank grid page (web/app/tank/[id]/page.tsx)
total_score: 23
p0_count: 0
p1_count: 2
timestamp: 2026-07-10T15-00-04Z
slug: web-app-tank-id-page-tsx
---
Method: dual-agent (A: design-review sub-agent · B: detector/browser-evidence sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | No loading state on the grid; quick-add shows "Adding…" but no success confirmation after submit |
| 2 | Match System / Real World | 3/4 | Tier/slot mental model maps well to a real tank |
| 3 | User Control and Freedom | 2/4 | Reset Grid uses a native `window.confirm()`, breaking out of the visual system at the one truly destructive action |
| 4 | Consistency and Standards | 2/4 | Quick-add form has no card container while the unplaced-specimen list right below it does; confirmed a live, unfixed instance of the button `margin-top: 1rem` bug (see below) |
| 5 | Error Prevention | 2/4 | Photo required on the propose-new fork is a good forcing function, but the public/private distinction is a single muted sentence before an irreversible, community-visible action |
| 6 | Recognition Rather Than Recall | 3/4 | Type-to-search avoids requiring exact coral names |
| 7 | Flexibility and Efficiency | 3/4 | Collapsing search/local-label/propose-new into one inline control removes a real navigation trip to `/identify` |
| 8 | Aesthetic and Minimalist Design | 3/4 | Generally lean; the search step surfaces too many options at once (see Priority Issues) |
| 9 | Error Recovery | 2/4 | `.error` paragraphs exist but weren't exercised; no inline field-level validation copy |
| 10 | Help and Documentation | 1/4 | Zero contextual help anywhere — no explanation of what "propose as new coral" actually does downstream |
| **Total** | | **23/40** | **Acceptable — significant improvements needed before users are happy** |

## Anti-Patterns Verdict

**Start here. Does this look AI-generated? No.**

**LLM assessment (Assessment A)**: Checked explicitly against every DESIGN.md Don't — no cream/sand background (confirmed `--bg: #f5f9fc`), no side-stripe borders, no gradient text, no hero-metric template, no identical card grids, no eyebrow labels, no numbered section markers, no shadow escalation on hover. Reads as a legitimate, restrained internal tool consistent with the "Coral Registry" brief, not a templated dashboard.

**Deterministic scan (Assessment B)**: Static CLI scan of all six target files — **exit 0, zero findings**, confirmed across three separate invocations (directory scan, per-file scan, and a quoted single-file scan to rule out shell globbing eating the result). The live-injected browser detector (real DOM injection, not read-only eval — confirmed via `document.title` + script-tag mutation, `detect.js` loaded 200 OK, `onload` fired) found exactly one anti-pattern: **overused-font** (roboto 81% / arial 19% of visible text).

**False positive, likely**: that arial share almost certainly comes from native `<select>`/`<input type="number">` browser-default font rendering (the tier slot picker, tank dimension fields), not an authored style choice in this page's own components — the static scan of the actual source came back completely clean, and DESIGN.md specifies Roboto as the system's only typeface with no arial anywhere in the CSS.

**Visual overlays**: injection succeeded and produced a real, visible orange banner fixed to the top of the page reporting the overused-font finding — confirmed via screenshot and `preview_inspect`. The live-server helper was stopped afterward and verified not running on port 8400.

## Overall Impression

Functionally solid and genuinely not AI-slop — the restraint (one accent color, one shadow tier, no decorative filler) is working. But two things pull the score down: the newest piece of UI (inline quick-add) asks the user to make its highest-stakes decision (public vs. private) with the least visual support anywhere on the page, and — more concretely — **the button `margin-top: 1rem` bug from the last two commits isn't actually fully fixed**. Assessment B found live, computed-style proof that it still affects the "+ Add a coral" button and the "Place"/submit buttons, because those are plain unclassed `<button>` elements, and the last fix only targeted buttons with `.btn-secondary`/`.tier-rail-buttons` classes.

## What's Working

- **The occupied-cell accent border** is a clean, correct application of DESIGN.md's One-Accent Rule — the single Shallow Reef Blue use on the grid, meaning exactly one thing.
- **Tier switching** is genuinely clear and correctly implemented — verified live: the SVG mockup's highlighted band moves in sync with the selected tier button, grid content swaps correctly, and the decorative mockup is properly `aria-hidden` rather than faked as informative.
- **Collapsing three add-paths (search / private label / propose-new) into one inline control** is a real friction reduction versus forcing a trip to `/identify` and back.

## Priority Issues

**[P1] The button margin-top bug is still live on this exact page, not fully fixed.** What: `web/components/quick-add-specimen.tsx`'s "+ Add a coral" button and its form-actions submit button, plus `web/components/place-specimen-control.tsx`'s "Place" button, are plain unclassed `<button>` elements that still inherit `margin-top: 1rem` from the site-wide reset (`globals.css` line ~126) — confirmed via computed styles (`margin-top: 16px`). Why it matters: inside the quick-add form's `.form-actions` flex row, this submit button now sits next to a `.btn-secondary` Cancel button with `margin: 0` — same row, mismatched margin boxes, visibly misaligned. This is a direct regression of the fix from the last two commits, which only zeroed `.btn-secondary` and `.tier-rail-buttons button`. Fix: either add `margin: 0` to the base unclassed-button case inside `.form-actions`/wherever these render, or give these buttons their own class and zero it there — the same root-cause pattern as before, just unswept corners. Suggested command: `/impeccable polish`.

**[P1] Public vs. private fork has no visual differentiation at the moment of consequence.** What: "Private — just for you, not shared with the wiki or community" and "Public — the community will vote on this identification" render as identical 0.85rem muted text, same position, same weight, in their respective forms — and the public notice appears *after* Name and Genus are already filled in, not before. Why it matters: this is the one place on the page where a wrong click has a permanent, other-people-visible consequence, and the design gives it the same weight as an aside. Fix: give the public-fork notice a stronger, distinct treatment (a status-colored callout, consistent with the existing difficulty-pill language) and move it above the fields, not after. Suggested command: `/impeccable harden`.

**[P2] Quick-add form has no card container, unlike everything else in its own section.** What: the quick-add form is a bare `<div>` with no border/shadow/radius, floating between the "Unplaced specimens" heading and the `.card`-wrapped list right below it. Why it matters: breaks DESIGN.md's own consistency principle within a single section. Fix: wrap it in `.card`. Suggested command: `/impeccable polish`.

**[P2] Reset Grid uses a native `window.confirm()` for the page's one truly destructive action.** What: `reset-grid-button.tsx` calls `window.confirm()` instead of an in-system confirmation. Why it matters: it's the single most destructive action on the page and the one moment that breaks out of the Coral Registry visual system into an OS dialog — inconsistent with a "trustworthy and precise" brand. Fix: replace with a styled in-app confirmation. Suggested command: `/impeccable harden`.

**[P2] Header auth state doesn't reflect the logged-in session.** What: confirmed live on an authenticated-only page — nav still shows "Log in" while genuinely signed in (dashboard confirms "Signed in as..."). Why it matters: for a registry brand built on precision, a nav bar that can't answer "am I logged in?" undercuts the exact trust the brand is supposed to earn. Fix: wire the header to real session state. Suggested command: `/impeccable harden`.

**[P3] Search step surfaces too many simultaneous, undifferentiated options.** What: 2+ characters typed can surface up to 8 result buttons + 2 fork links + Cancel — up to 11 live choices with no visual grouping between "a real match," "the fallback prompt," and "give up." Why it matters: works against both recognition-over-recall and DESIGN.md's minimalism. Fix: only show the fork prompt once results are empty, or visually separate the two tiers. Suggested command: `/impeccable layout`.

## Persona Red Flags

**Jordan (first-timer)**: types a coral nickname, gets zero matches, sees "Just label this slot… or propose it as a new coral" with zero prior explanation of the difference (Heuristic #10 scored 1/4 for exactly this). Likely picks whichever sounds easier, even if they actually know the species and should propose it — the copy doesn't help them decide.

**Sam (accessibility)**: tier-picker buttons carry no `aria-pressed`/`role="tab"` — confirmed via rendered DOM (`<button class="selected">Tier 1</button>`, no ARIA state at all). A screen-reader user gets "Tier 1, button" / "Tier 2, button" with no indication which is active. Search results are also plain buttons with no `role="listbox"`/`aria-live` count announcement.

**Riley (stress-tester)**: typed "asdfzzz" — no distinct "no results" message, just silence where results would be, fork prompt appearing simultaneously; no on-screen hint that search needs 2+ characters at all.

## Minor Observations

- Mobile header (375px) wraps badly — "Reef Platform" breaks to two lines, "Log in" splits mid-word. Outside this page's own files but visible on every visit.
- `.taxon-result` search-result buttons have no affordance beyond cursor-pointer + hover background — look like static rows until hovered.
- The photo `<input type="file">` in all three quick-add forms is completely unstyled native chrome, standing out against the otherwise-consistent Reef White/Sandbar input styling.
- `SlotPicker` option labels ("B1 · L1") use tier notation ("L1"/"L2") that appears nowhere else on the page — the tier rail says "Tier 1/2," the grid cells show no tier suffix at all. A small terminology inconsistency.

## Questions to Consider

- What if "propose it as a new coral" didn't live inline at all, and the quick-add flow only ever offered "search" or "label privately" — would that remove the one place a low-friction interaction and a high-stakes public action are forced to share a UI?
- What if the public/private distinction were two visually distinct entry buttons right after a failed search, instead of two inline text links of identical weight?
- What if Reset Grid's confirmation reused the same card/button system as the rest of the page — would that change how "safe" the whole destructive-action path feels?
