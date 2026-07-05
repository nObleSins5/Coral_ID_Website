# Schema Decisions

*Companion to `docs/reef-platform-spec.md` and the two SQL files in `sql/`. This
records the design decisions behind the database schema — including the many
where the recommendation was simply accepted — so the reasoning survives even
when the "why" isn't obvious from the DDL. Captured 2026-07-05.*

The spec (`reef-platform-spec.md`) remains the product source of truth. This
document is the *schema* rationale: what we chose, and why, for
`coral_trait_schema.sql` (the wiki/taxonomy side) and `reef-platform-schema.sql`
(everything else).

---

## 1. Global conventions

| Decision | Rationale |
|---|---|
| **PostgreSQL** | JSONB, arrays, rich constraints, `pg_trgm` fuzzy search, and a path to PostGIS for future geo. |
| **UUID primary keys** on public-facing tables (`gen_random_uuid()`) | Photos, QR pages, specimens, and wiki entries are public; IDs shouldn't be guessable or enumerable. |
| **SEO slugs** on wiki entries and public pages | Clean, indexable URLs (`/coral/acropora/pink-stardust`). |
| **Lookup tables over native enums** for status/type vocabularies | Postgres enums are painful to alter; lookups carry labels and grow freely. Tiny, closed, stable sets (e.g. vote value ±1, dosing element) use `CHECK` instead. |
| **`TIMESTAMPTZ` (UTC) everywhere**, `created_at` / `updated_at` (trigger-maintained) / `deleted_at` soft delete | Standard auditing; soft delete matters because a deleted parameter reading must not silently break a photo's stamped snapshot. |
| **Append-only** for `parameter_readings` and `coral_photos` | These are the crowdsourced data-capture tables; correct via a new row, never edit-in-place, to protect dataset integrity. |

## 2. The two-file contract

- **One PostgreSQL database, two files.** `coral_trait_schema.sql` owns the
  *wiki entry* (naming hierarchy + trait/color profiles); `reef-platform-schema.sql`
  owns everything else.
- **Load order: `coral_trait_schema.sql` first, then `reef-platform-schema.sql`.**
  The platform file's foreign keys reference `taxon_nodes`, defined in the trait file.
- **The wiki entry is a single `taxon_nodes` table** (self-referencing, UUID PK),
  not four separate tables. This lets a specimen/photo be identified to *any*
  level (genus-only when the morph is unknown) and supports hidden levels.
- **Hard FKs point platform → `taxon_nodes`** (grouped in the platform file's
  final section so it can still be applied standalone).
- **Cross-file links from trait → platform are intentionally SOFT** (uuid column,
  no enforced FK) to avoid a circular dependency between the files:
  `color_stops.source_photo_id` → `coral_photos`, and
  `taxon_recommended_products.product_id` → `husbandry_products`. The important
  integrity direction (specimens/photos → real taxa) is hard-enforced.

## 3. Users, auth, identity

- **Provider-agnostic auth.** `users.password_hash` is nullable, with
  `auth_provider` / `external_auth_id` alongside it. Roll-your-own (Argon2id) and
  a managed provider both fit the same table with no migration. *Intended app-side
  approach: Supabase Auth* — Postgres-native, generous free tier, social login and
  password reset built in, exportable password hashes (low lock-in) — but this is
  a build-time choice the schema does not force.
- **Single `users` table** for hobbyist and business accounts, distinguished by
  `account_type_code`.
- **Businesses have multiple staff logins** via a `business_members` join
  (role owner/staff). Billing is kept **thin** (`subscription_tier`,
  `subscription_status`, `external_billing_id`) since pricing is an open decision.
- **External community profiles** (`user_external_profiles`) support several
  accounts per user for a "Find me on: …" row. `profile_url` is always stored and
  is the source of truth for the link, so a template drift never breaks it.
  Unknown platforms are first-class (`custom_platform_name`). **Level 1 (clickable
  link) is built; `feed_url` and verification columns are reserved, unbuilt.**

## 4. Tanks & grid

- **Dimension-driven grid.** Create-Tank captures L×W×H → derives how many slots
  fit → the user places corals by **coordinate label** (e.g. `C5`, `C5 · L2`). No
  mm-precise placement.
- **X/Y/Z coordinates** on `grid_slots`; `tanks.tier_count` records the number of
  height tiers. **Single-tier frag tanks (`tier_count = 1`) hide the Z dimension**
  in the UI.
- **No historical slot occupancy.** `specimens.grid_slot_id` holds current
  placement; moves are updates. QR "shows whatever currently lives here" is served
  from the current value.

## 5. Water parameters vs. husbandry (the differentiator)

- **Parameters and husbandry are separate concepts.** Raw parameters alone don't
  explain coloration — the *regimen* does — so they're modeled apart.
- **`parameter_readings` is pure and append-only, with no freeform field.** Core
  five as typed columns: **alkalinity, calcium, magnesium, nitrate, phosphate**.
  Also-present optional columns: temperature, salinity, pH, ammonia, nitrite.
- **Husbandry is a temporal layer** so a photo can be correlated with what was
  being dosed at the time:
  - **`husbandry_products`** — a *shared, community-moderated* catalog (parallel to
    `coral_aliases`), **not free-typed per user**, so cross-tank aggregation
    ("tanks dosing X trend toward color Y") is meaningful.
  - **`dosing_methods`** — how a tank maintains alk/ca/mg over time (2-part,
    Balling, kalkwasser, calcium reactor, dosed supplement, water-change-only,
    other).
  - **`tank_additives`** — everything else in the water (amino acids, coral food,
    trace, etc.), also temporal.
- **Exact dose fields are designed but deferred in the UI.** `dose_amount`,
  `dose_unit`, `days_of_week`, `times_per_day` exist on `tank_additives` because
  they were requested to be exact, but they churn frequently so they're
  schema-ready, not surfaced day one. Logging tiers: ~30s for parameters, ~2 min
  for method + product.
- **Units:** store **alkalinity in dKH**, Ca/Mg/NO₃/PO₄ in **ppm**, **temperature
  canonical** with a per-user °C/°F display toggle (`users.preferred_temp_unit`).

## 6. Equipment

- **User-defined Low/Med/High setpoints** live in `equipment_levels`, **for light &
  flow gear only**, expressed as a **percent (0–100)**. Brand-based default
  setpoints can be seeded later. Each user decides what "High" means for *their*
  gear.
- **`equipment_events`** is a timestamped log (level change / installed / removed /
  adjusted) so equipment changes overlay on the parameter/coloration graphs.

## 7. Specimens & photos

- **A photo is standalone or attached to a specimen** (`coral_photos.specimen_id`
  nullable).
- **The parameter snapshot on a photo is both a FK and a denormalized copy.** The
  FK (`parameter_reading_id`) keeps lineage; the copied core values +
  `snapshot_measured_at` make the snapshot immutable and make **freshness
  (`taken_at − snapshot_measured_at`) a trivial, tamper-proof trust signal**.
- **Object storage, blob never in the DB.** `storage_provider` / `storage_key` /
  `url` + `mime` / `width` / `height` / `bytes` / `checksum`. Storage target not
  yet chosen; nothing in the schema forces one.
- **Capture context, added for the multi-lighting diagram and because EXIF can
  only be captured at upload (or it's lost):**
  - `capture_metadata jsonb` — opportunistic EXIF (white balance, exposure, ISO,
    color space, camera). Sparse/variable and often stripped, hence jsonb.
  - `light_equipment_id` → `equipment`, `light_level_id` → `equipment_levels` — the
    **reef illuminant**, a stronger signal than EXIF (which records camera
    settings, not the tank's light spectrum). `lighting_note` is a free-text
    fallback when gear isn't logged.

## 8. Identification & the naming tree

- **`taxon_nodes` is a universal reef-organism naming tree**, generalized *above*
  coral: top rank `category` (Coral, Fish, Invertebrate, Plant, Other) → `genus` →
  `species` → `morph`. Coral is one (hidden) category node. Fish or other
  organisms can be added later — they'd share `taxon_nodes` and get their own trait
  tables (a fish has no corallite/polyp). A single super-root above `category` is a
  one-line add if ever wanted.
- **Ten `element_profiles`** for the identifiable coral parts (researched/expanded
  from the original four): corallite, axial corallite, radial corallite, polyp,
  tentacle, mouth/oral disc, coenosarc/skin, base/body, growth tip, surface
  texture.
- **Color model `color_ranges → color_stops`.** A coloration is a *pattern*
  (solid / range / rainbow / banded / spotted / mottled / tipped / ringed) made of
  ordered hex stops: solid = 1 stop, range = 2 (from/to), rainbow = N. Each stop
  can be **pinpoint-sampled from a real photo** (`source_photo_id` + normalized
  coordinates) rather than hand-typed. **Fluorescence was dropped** — it's a
  lighting artifact, not an inherent trait.
- **Morphology is all dropdowns** (controlled vocab), not free text:
  `growth_form`, `care_difficulty`, `corallite_shape`, `skin_texture`,
  `polyp_size` — plus numeric `size_min_mm`/`size_max_mm` on the polyp element.
- **Aliases (`coral_aliases`) are unique per node, not globally.** The same trade
  name ("Rainbow") legitimately maps to many unrelated corals, so uniqueness is
  `(taxon_node_id, alias_name_normalized)`; a trigram index handles fuzzy/misspelled
  hobby names; searches that hit several nodes disambiguate.
- **ID suggestions target any hierarchy level** (`proposed_taxon_id`) or propose a
  not-yet-existing name (`proposed_name`). **Votes are one per (user, suggestion),
  ±1**, with a reserved `weight` for future trust-weighting (Phase 3). The
  **confirmation threshold lives in `app_settings`**, not hard-coded.

## 9. Provenance (protected layer)

- **Source can be a prior specimen, a business, a user, or free-text/unknown**;
  `visibility` defaults to **private**. Expected to be incomplete, and
  identification never depends on it.
- **Single source per specimen for now**, but modeled in its own table so it can
  become many-to-many (multi-parent frags) without a migration.

## 10. Retail & community

- **QR codes bind to a `grid_slot`** (unique, generated once, reused forever); the
  public page resolves slot → current specimen.
- **`inquiries` are modeled but dormant** (feature not built this phase),
  anonymous-capable (optional `user_id` + contact fields), status
  open/fulfilled/cancelled; fulfilling with a known buyer can trigger lineage.
- **`want_list`** references a taxon node; the trade opt-in is
  `users.visible_to_traders`. Discovery/matching is Phase 4.
- **Affiliate links attach to the `coral_photos` row**, not the taxon — vendors
  compete on the same coral by showcasing *their* photo; wiki pages aggregate by
  taxon via the photo. `affiliate_clicks` logs outbound clicks (hashed IP, no PII)
  for commission reconciliation and ranking.
- **`notifications`** is a simple table now (type + jsonb payload + `read_at`),
  since inquiries and ID confirmations both need it.
- **Messaging is stubbed** (`conversations`, `conversation_participants`,
  `messages`) but the feature is **deferred to Phase 4**; the first version will be
  constrained to match-initiated 1:1 threads to keep the abuse surface small.
- **Geo foundation:** store `zip`/`region`/`state` now + a reserved `zip_geo`
  (zip → lat/long) table; radius search is built in Phase 4.

## 11. Care guidance & seed content

- **Care guidance lives on `taxon_nodes`** (chiefly morph-level, since morphs
  differ): `care_difficulty`, `light_level`, `flow_level`, recommended parameter
  ranges, placement, description — the "what it takes to keep it alive" data for
  Door 1 and Door 3.
- **`taxon_reference_images`** provides curated hero images so wiki pages are never
  blank before community photos exist (community galleries still come from
  `coral_photos`).
- **`taxon_recommended_products`** (soft-linked to `husbandry_products`) captures
  additives associated with better coloration/health for a given coral.

## 12. Planned tooling & its schema impact

- **`scripts/draw_diagrams.py`** is not an ER-diagram generator (its original
  placeholder). Its real purpose is a **scientific-illustration-style coral
  identification diagram rendered from the trait data** (`element_profiles` +
  `color_stops` + morphology). The reference `draw_diagrams.py` hand-codes a Walt
  Disney Acropora whose color dict maps one-to-one onto our color model — so the
  data-driven version reads hex per element from the DB. **No schema change needed**
  (branch geometry is procedural per `growth_form`, a rendering concern).
- **`scripts/normalize_reef.py`** (per-photo blue-light correction, hand-tuned per
  image) is **not pursued** — reprocessing every upload is too intensive. Instead
  the **diagram is rendered under multiple lighting presets** ("heavy blue → these
  colors; white → this"), and photos carry their lighting context (§7) so the
  matching preset can be shown.
- **Multi-lighting, if we later store real observed colors *per lighting*** rather
  than transforming a single reference set, would be a small **additive** change: a
  `lighting_profiles` lookup + a nullable `lighting_profile_code` on `color_ranges`.
  Deferred; nothing needs to change now.

## 13. Open decisions (deferred, not guessed)

- Final platform name / branding.
- Business subscription pricing and tier limits.
- Affiliate partners and commission terms.
- Source of typical element color ranges (curated seed vs. derived from confirmed
  photos).
- Default visibility of each naming-hierarchy level at launch.
- Moderation policy for disputed IDs and aliases.
- Whether retail tanks default to a precise (A1/B2) grid — confirm with pilot shop.
- App-side auth approach (schema is provider-agnostic; Supabase Auth is the
  current lean).
- Storage target for images.
- Whether multi-lighting uses render-time transforms or stored per-lighting colors.
