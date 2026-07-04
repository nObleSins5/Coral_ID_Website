# Reef Platform

A community-driven platform for reef aquarium hobbyists to log tank parameters, equipment, and coral inventory — building a crowdsourced record that links coral coloration to the conditions that produced it. Working title; not yet branded.

Full product context, guiding principles, phased roadmap, and page-by-page sitemap live in the spec below. Start there before touching code or schema.

## Repo layout

```
docs/
  reef-platform-spec.md      Product & build specification (source of truth — read first)
sql/
  coral_trait_schema.sql     Species/morph trait schema (genus, growth form, corallite shape, color, fluorescence)
  reef-platform-schema.sql   Core app schema — users, tanks, specimens, photos, etc. (not yet written)
scripts/
  draw_diagrams.py           Generates ER diagrams from the SQL schema files
  normalize_reef.py          Data-cleanup / normalization utility
```

## Status

Spec is drafted and amended (see the change log in Appendix A of the spec). Database schema exists for the coral trait wiki (`coral_trait_schema.sql`); the core platform schema (`reef-platform-schema.sql`) is not yet written — see §7.1 of the spec for the field-level changes it needs to pick up from the latest amendments.

No application code yet. Current phase: **Phase 0 — Foundation** (see spec §4).

## Non-goals

This platform is never a marketplace, a payment processor, a shipping company, or a genetic-identity authority. See spec §1 for the full explanation — this boundary is load-bearing for every feature decision.
