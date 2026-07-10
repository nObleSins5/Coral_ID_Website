---
name: Coral Registry
description: A structured registry for reef corals and the tanks that hold them — precise, quiet, data-first.
colors:
  shallow-reef-blue: "#70d6ff"
  deep-water-blue: "#0369a1"
  abyssal-ink: "#072433"
  tide-pool-mist: "#f5f9fc"
  reef-white: "#ffffff"
  sandbar: "#e1e8ee"
  basalt: "#16202a"
  wet-slate: "#55636e"
  bleached-coral-red: "#b91c1c"
  polyp-lime: "#e9ff70"
  sun-bleached-yellow: "#ffd670"
  low-tide-orange: "#ff9770"
  anemone-pink: "#ff70a6"
typography:
  headline:
    fontFamily: "Roboto, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "normal"
  title:
    fontFamily: "Roboto, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "normal"
  body:
    fontFamily: "Roboto, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Roboto, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "7px"
  lg: "10px"
  pill: "999px"
spacing:
  xs: "0.4rem"
  sm: "0.6rem"
  md: "1rem"
  lg: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.shallow-reef-blue}"
    textColor: "{colors.abyssal-ink}"
    rounded: "{rounded.md}"
    padding: "0.6rem 1rem"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.wet-slate}"
    rounded: "{rounded.md}"
    padding: "0.6rem 1rem"
  card:
    backgroundColor: "{colors.reef-white}"
    rounded: "{rounded.lg}"
    padding: "1.1rem 1.25rem"
  input:
    backgroundColor: "{colors.reef-white}"
    textColor: "{colors.basalt}"
    rounded: "{rounded.md}"
    padding: "0.55rem 0.65rem"
  pill:
    backgroundColor: "transparent"
    textColor: "{colors.wet-slate}"
    rounded: "{rounded.pill}"
    padding: "0.1rem 0.5rem"
---

# Design System: Coral Registry

## 1. Overview

**Creative North Star: "The Coral Registry"**

This is a registry, not a storefront and not a field guide — the distinction matters. Every coral morph, every tank, every specimen a hobbyist logs is an *entry*: a structured record with its own detail page, cross-linked to related entries (a morph to its genus and aliases, a specimen to its tank slot and representative photo, a business listing to the photo it's attached to), carrying real metadata (hex color stops, parameter ranges, vote counts) the way IMDb carries cast/crew/ratings or Metacritic carries scores. The registering-and-maintaining act — proposing a new morph, confirming an identification, placing a specimen in a grid slot — is the product, not a feature bolted onto a marketing site.

This system explicitly rejects the generic AI-dashboard look: no gradient hero metrics, no cream/sand near-white neutrals dressed up as "warmth," no side-stripe accent borders, no identical icon-heading-text card grids repeated for their own sake. Confidence comes from showing real numbers plainly — a real hex value, a real vote count, a real parameter range — not from decorating the page around them.

**Key Characteristics:**
- Registry-entry pages over marketing pages — dense, structured, cross-linked
- One quiet accent color, used sparingly, never decoratively
- Flat surfaces with a single whisper-soft shadow tier, not a layered elevation system
- Coral photography and real data are the loudest things on any page — the UI recedes around them
- One typeface, Roboto, carrying the whole hierarchy through size and weight, not font-pairing drama

## 2. Colors

A near-monochrome blue system (the registry's own quiet identity) plus a small, semantically-locked supporting set that only ever appears as status/difficulty signal, never as decoration.

### Primary
- **Shallow Reef Blue** (#70d6ff): The one accent. Button fills, badge backgrounds, the border that marks an occupied tank-grid cell, the "selected" state on a tier picker. Light and vivid by design — it always sits under Abyssal Ink text, never under white.
- **Deep Water Blue** (#0369a1): A darker tone from the same hue, used wherever Shallow Reef Blue would fail contrast as text or a link — link color, hover borders on cards, focus outlines, the underline-style "link-button." This is the color that actually carries legibility; Shallow Reef Blue carries surface.

### Neutral
- **Tide Pool Mist** (#f5f9fc): Page background. Barely blue — present enough to feel like water, not so present it competes with content.
- **Reef White** (#ffffff): Every card, panel, and input surface sits on this, one step whiter than the page itself.
- **Sandbar** (#e1e8ee): The one hairline border color, used everywhere a surface needs a visible edge without weight.
- **Basalt** (#16202a): Primary text.
- **Wet Slate** (#55636e): Secondary/muted text — labels, breadcrumbs, timestamps, anything that should read as context rather than content.
- **Abyssal Ink** (#072433): Not a neutral in the usual sense — this is the dedicated text color for anything sitting on top of an accent-colored surface (button labels, badge text, the selected tier button). Never use plain white there.

### Status (locked to meaning — never decorative)
- **Bleached Coral Red** (#b91c1c): Errors only. The name is deliberate — this product's whole subject is coral color, and "bleached" is the one color state nobody wants to see.
- **Polyp Lime** (#e9ff70): Confirm / positive. The "voted" state on a photo-accuracy vote, the easiest tier of the care-difficulty escalation.
- **Sun-Bleached Yellow** (#ffd670): Moderate care difficulty.
- **Low-Tide Orange** (#ff9770): Difficult care difficulty — a warning tier, one step short of the top.
- **Anemone Pink** (#ff70a6): Expert care difficulty, and separately, the "wishlisted" state on a wanted coral. Both readings share one idea: wanted, and not easy to get.

### Named Rules
**The One-Accent Rule.** Shallow Reef Blue is the only color used for a plain UI affordance (a default button, a default badge). The four status colors never substitute for it — they only ever appear attached to their one specific meaning (a difficulty tier, a vote state, a wishlist state), never as a generic accent alternative.

**The Ink-on-Accent Rule.** Anything placed on top of an accent- or status-colored surface uses Abyssal Ink, never white. All four status colors and the primary accent are light/vivid enough that white text fails contrast on them.

## 3. Typography

**Body Font:** Roboto (with system-ui, -apple-system, Segoe UI, sans-serif fallback)

**Character:** One typeface for the entire registry — no display face, no pairing. Hierarchy comes from size and weight alone (1.6rem/700 down to 0.85rem/400), which reads as a structured data system rather than an editorial layout. This is a deliberate choice, not an unfinished one: a registry's job is to present entries consistently, not to perform typographic personality per page.

### Hierarchy
- **Headline** (700, 1.6rem, line-height 1.5): Page-level `h1` — a tank name, a morph name, "Coral wiki."
- **Title** (700, 1.15rem, line-height 1.5): Section-level `h2` — "Recommended parameters," "Unplaced specimens," "Where to find it."
- **Body** (400, 1rem, line-height 1.5): Everything else — paragraph text, table cells, form values.
- **Label** (400, 0.85rem, color Wet Slate): Form labels, breadcrumbs, muted context lines. Always Wet Slate, never Basalt — a label is scaffolding around content, not content itself.

### Named Rules
**The Single-Voice Rule.** No second typeface gets introduced for "personality." If a heading needs more presence, it earns it through size or weight within Roboto's own range, not a display font import.

## 4. Elevation

Flat with a whisper of lift. Every card, panel, and grid uses exactly one shadow value — `0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.08)` — soft enough that it reads as "this is a surface" rather than "this is raised." There is no second, heavier tier for hover or "important" cards, and no hover-lift transform. Depth is not a hierarchy signal in this system; borders and the Sandbar/Reef White contrast do that work instead.

### Shadow Vocabulary
- **Ambient** (`box-shadow: 0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.08)`): The only shadow in the system. Applied at rest to every card-like surface (`.card`, `.genus-card`, `.morph-row`, `.photo-card`, `.identify-card`). Never intensified on hover, never used to imply interactivity.

### Named Rules
**The Whisper Rule.** One shadow value, used uniformly, never escalated. If a surface needs to feel more important than another, that's a typography or color-status decision, not a shadow decision.

## 5. Components

Quiet and functional. Every component uses a solid fill or a plain border — no gradients, no glass, no heavy shadow — so that coral photography and real data stay the loudest things on the page.

### Buttons
- **Shape:** 7px radius (`--rounded: 7px`), consistent across primary and secondary.
- **Primary:** Shallow Reef Blue background, Abyssal Ink text, 600 weight, `0.6rem 1rem` padding, no border.
- **Hover:** `filter: brightness(1.08)` — a small lift in brightness, nothing structural.
- **Secondary (`.btn-secondary`):** Transparent background, Wet Slate text, Sandbar border. Used for "Cancel," "Deactivate," and other lower-stakes actions sitting next to a primary button.

### Pills & Badges
- **Neutral pill (`.pill`):** Transparent background, Wet Slate text, Sandbar border, fully rounded (999px). Used for light/flow/growth-form tags and account-type labels — informational, never actionable.
- **Difficulty pill (`.pill-difficulty`):** Same pill shape, no border, filled with the escalating status color (Polyp Lime → Sun-Bleached Yellow → Low-Tide Orange → Anemone Pink) and Abyssal Ink text, 600 weight. The one place color carries meaning at a glance.
- **Toggle pill (vote / wishlist buttons):** Same shape and border as the neutral pill at rest; on the "active" state (`.voted`, `.wishlisted`) it fills solid with its status color (Polyp Lime for confirm, Anemone Pink for wishlist) and switches to Abyssal Ink text.

### Cards / Containers
- **Corner Style:** 10px radius, uniformly.
- **Background:** Reef White on Tide Pool Mist.
- **Shadow Strategy:** The single Ambient shadow (see Elevation), always.
- **Border:** 1px Sandbar.
- **Internal Padding:** `1.1rem 1.25rem` for a standalone card; tighter (`0.75rem 1rem`) for list-row-shaped cards like `.morph-row`.

### Inputs / Fields
- **Style:** Reef White background, 1px Sandbar border, 7px radius, Basalt text.
- **Focus:** 2px Deep Water Blue outline, 1px offset — deliberately the darker blue, not the light primary accent, so focus stays legible against a white input.

### Navigation
- **Style:** A single-row header (`.site-header`) on Reef White with a Sandbar bottom border. Nav links use Deep Water Blue (the link color throughout the system), underlining only on hover. No active-state treatment beyond that — the registry doesn't need a heavy nav system, it has three top-level links (Identify, Wiki, Dashboard).

### Tank Grid Cell (signature component)
The one place the registry becomes spatial rather than tabular: each occupied cell gets a Shallow Reef Blue border (the only border in the system that isn't Sandbar) and, when the placed specimen has a photo, a small `2.2rem`-tall cropped thumbnail above its name — the cell itself becomes a miniature registry entry.

## 6. Do's and Don'ts

### Do:
- **Do** use Shallow Reef Blue for exactly one thing at a time on any given screen: the primary action or the primary "you are here" signal. Never two unrelated uses of it on the same page.
- **Do** keep every card at 10px radius and the single Ambient shadow — consistency here is what makes the registry feel like one system, not per-page hobbles.
- **Do** let hex values, vote counts, and parameter numbers appear as plain text at full contrast (Basalt) — they are the content, not secondary detail.
- **Do** use Abyssal Ink, never white, as text on any accent- or status-colored surface.

### Don't:
- **Don't** introduce a cream/sand/parchment near-white background. Tide Pool Mist is a barely-blue neutral for a reason — a warm neutral reads as generic AI-tool default, not this registry's own identity (per PRODUCT.md's anti-reference).
- **Don't** use `border-left`/`border-right` as a colored accent stripe on any card, list item, or callout. If something needs to stand out, use the Shallow Reef Blue border treatment already established on occupied tank-grid cells, not a side stripe.
- **Don't** use gradient text or gradient fills anywhere. Every color in this system is a single flat value.
- **Don't** add a second shadow tier or a hover-lift transform to cards. The Whisper Rule is one shadow, always.
- **Don't** decorate the hex-color and element-color-key swatches as UI chrome — they render real sampled coral color and must stay exactly what they are, not be re-skinned to match a seasonal palette.
- **Don't** import a second typeface for "personality." Roboto carries the whole hierarchy.
