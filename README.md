# Reef Platform

A community-driven platform for reef aquarium hobbyists to log tank parameters, equipment, and coral inventory — building a crowdsourced record that links coral coloration to the conditions that produced it. Working title; not yet branded.

Full product context, guiding principles, phased roadmap, and page-by-page sitemap live in the spec below. Start there before touching code or schema.

## Repo layout

```
docs/
  reef-platform-spec.md      Product & build specification (source of truth — read first)
sql/
  coral_trait_schema.sql     Wiki side: universal naming tree + coral trait/color profiles + care guidance
  reef-platform-schema.sql   Core app: users, tanks, parameters, husbandry, specimens, photos, IDs, retail, community
scripts/
  draw_diagrams.py           (planned, not implemented) Coral identification diagram renderer — see below
  normalize_reef.py          (planned, not implemented) Lighting normalization — being reconsidered, see below
```

## Status

Spec is drafted and amended (change log in Appendix A of the spec). **Both database schemas are now written and validated** against a live PostgreSQL instance — all tables, indexes, triggers, constraints, and the cross-schema foreign keys apply and enforce cleanly. The spec's §7.1 "SQL changes still required" are implemented.

No application code yet. The `scripts/` are described below but not implemented. Current phase: **Phase 0 — Foundation** (see spec §4).

## Database schema

Two files, one PostgreSQL database. **Load order: `coral_trait_schema.sql` first, then `reef-platform-schema.sql`** — the platform file's foreign keys reference `taxon_nodes`, which the trait file defines.

Conventions across both files: UUID primary keys on public-facing tables, `TIMESTAMPTZ` (UTC) everywhere, `created_at` / `updated_at` (trigger-maintained) / `deleted_at` soft delete, lookup tables for status/type vocabularies, and append-only treatment for the crowdsourced data-capture tables.

### coral_trait_schema.sql — the wiki entry

Owns the naming hierarchy and coral identification traits.

- **Universal naming tree.** `taxon_nodes` is self-referencing and generalized *above* coral: the top rank is `category` (Coral, Fish, Invertebrate, Plant, Other), then `genus → species → morph`. Coral is just one (hidden) category node, so fish or other organisms can slot in later — they'd share `taxon_nodes` and get their own trait tables.
- **Controlled-vocabulary dropdowns** for ranks, element types, growth form, care difficulty, care levels, corallite shape, skin texture, polyp size, color pattern, and a named-color palette.
- **Element profiles** for the ten identifiable coral parts (corallite, axial/radial corallite, polyp, tentacle, mouth/oral disc, coenosarc/skin, base/body, growth tip, surface texture), each with the morphology fields relevant to it.
- **Color model:** `color_ranges → color_stops`. A coloration is a pattern (solid / range / rainbow / banded / spotted / mottled / tipped / ringed) made of ordered hex stops — solid = 1 stop, range = 2 (from/to), rainbow = N. Each stop can be **pinpoint-sampled from a real photo** (soft link + normalized coordinates). *Fluorescence was dropped* — it's a lighting artifact, not an inherent trait.
- **Care guidance per node** (morph-level, since morphs differ): light & flow levels, recommended parameter ranges, difficulty, placement — the "what it takes to keep it alive" data for Door 1 / Door 3.
- **Curated reference images** so wiki pages are never blank before community photos exist, plus **recommended-product links** (additives associated with better coloration).

### reef-platform-schema.sql — everything else

Owns users, tanks, logging, specimens, photos, identification, retail, and community.

- **Users & identity:** provider-agnostic auth (`password_hash` nullable so a managed provider like Supabase Auth can be adopted without a migration); multi-account external profiles ("Find me on: …") with reserved verification/feed columns; businesses with staff memberships and thin billing.
- **Tanks & grid:** dimension-driven X/Y/Z grid slots with coordinate labels (e.g. `C5 · L2`); single-tier frag tanks hide Z.
- **Parameters vs. husbandry:** append-only, freeform-free `parameter_readings` (alk / Ca / Mg / NO₃ / PO₄ core) kept separate from a *temporal* husbandry layer — a shared, moderated product catalog plus dosing methods and additives (exact dose fields designed but deferred in the UI). This split is what powers the coloration-vs-conditions thesis.
- **Equipment:** user-defined Low/Med/High percent setpoints on light & flow gear, with a timestamped event log for graph overlay.
- **Specimens & photos:** append-only `coral_photos`, public by default, each carrying an **immutable parameter snapshot** (FK + denormalized copy) so photo-vs-reading freshness is a trust signal.
- **Identification:** aliases (per-node uniqueness, since one trade name can span many corals), ID suggestions at any hierarchy level, one-vote-per-user, and a confirmation threshold stored in `app_settings`.
- **Provenance:** private-by-default chain of custody.
- **Retail & community:** slot-bound QR codes, dormant-but-modeled inquiries, want list, **photo-attached** affiliate links with click tracking, notifications, stubbed messaging tables (feature deferred), and a zip→geo foundation.

## Coral identification diagram (planned — Phase 2–3)

`scripts/draw_diagrams.py` is **not** an ER-diagram generator (its original placeholder description). Its real, more valuable purpose: a **scientific-literature-style diagram of a coral, rendered on its wiki page using the exact hex colors we model**, to guide a user identifying their own coral. It reads straight from the trait schema — `element_profiles` (which parts), `color_ranges` / `color_stops` (hex colors + pattern), and the morphology fields (shape / size / growth form) — so the picture on the page is generated from the same structured data users compare against. This builds on the Phase 0 element/color seed data and matures with the Phase 3 "element-level color-range profiles" differentiator.

**Multiple lighting settings (replaces the per-photo normalization idea).** `scripts/normalize_reef.py` was written to take a heavy-blue-light photo and correct it back to a reference standard lighting profile. Running every uploaded photo through an image processor is too intensive; instead we plan to use the **diagram itself as the color reference rendered under different lighting presets** — "under heavy blues the coral shows these colors, under whites it looks like this" — so a user comparing their blue-lit tank can match the right lighting rather than us reprocessing their photo.

### Schema readiness for these features

- **The diagram needs no schema changes** — it's a renderer over data the trait schema already stores (elements, hex color stops, patterns, morphology).
- **Multi-lighting** can go two ways: (a) render-time color transforms from the single reference color set — no schema change, lighting presets live in app config; or (b) storing actual observed colors *per lighting*, a small **additive** change — a `lighting_profiles` lookup + a nullable `lighting_profile_code` on `color_ranges`, and optionally a lighting descriptor on `coral_photos` so photo-sampled stops carry the light they were shot under. Both are deferrable; nothing needs to change now.

## Non-goals

This platform is never a marketplace, a payment processor, a shipping company, or a genetic-identity authority. See spec §1 for the full explanation — this boundary is load-bearing for every feature decision.
