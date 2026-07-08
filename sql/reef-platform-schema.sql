-- =============================================================================
-- Reef Platform — Core Application Schema (reef-platform-schema.sql)
-- =============================================================================
-- Companion to coral_trait_schema.sql. This file owns EVERYTHING EXCEPT the
-- coral naming hierarchy and the element/color trait profiles, which live in
-- coral_trait_schema.sql (the "wiki entry" itself).
--
--   * coral_trait_schema.sql  -> taxon_nodes (L1 coral -> L2 genus -> L3 species
--                                -> L4 morph), element_profiles, color_ranges.
--   * reef-platform-schema.sql (this file) -> users, tanks, parameters,
--                                husbandry, equipment, specimens, photos,
--                                identification, provenance, retail, community.
--
-- Both files target a SINGLE PostgreSQL database. Tables here reference
-- taxon_nodes via UUID columns; the actual cross-schema FOREIGN KEYs are added
-- in the final section ("Cross-schema foreign keys") so this file can be
-- applied on its own today, before coral_trait_schema.sql exists. Once the
-- companion file is written, apply coral_trait_schema.sql FIRST, then this
-- file, then the cross-schema FK section will validate cleanly.
--
-- Conventions (agreed during design):
--   * PostgreSQL. UUID primary keys (gen_random_uuid) on public-facing tables.
--   * TIMESTAMPTZ everywhere, stored UTC. created_at/updated_at/deleted_at.
--   * Soft delete (deleted_at) on user-owned content; append-only tables
--     (parameter_readings, coral_photos) are never edited in place.
--   * Lookup tables for status/type sets that carry labels or may grow;
--     CHECK constraints for tiny, closed, stable sets.
--   * Auth is provider-agnostic: password_hash is nullable so a managed
--     provider (e.g. Supabase Auth) can be adopted without a migration.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;      -- case-insensitive username/email
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fuzzy alias / name search

-- Shared trigger to maintain updated_at on mutable tables.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 1. Reference / lookup tables
-- =============================================================================

CREATE TABLE account_types (
    code  text PRIMARY KEY,
    label text NOT NULL
);
INSERT INTO account_types (code, label) VALUES
    ('hobbyist', 'Hobbyist'),
    ('business', 'Business');

CREATE TABLE moderation_statuses (
    code  text PRIMARY KEY,
    label text NOT NULL
);
INSERT INTO moderation_statuses (code, label) VALUES
    ('proposed', 'Proposed'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected');

CREATE TABLE id_statuses (
    code  text PRIMARY KEY,
    label text NOT NULL
);
INSERT INTO id_statuses (code, label) VALUES
    ('pending',    'Pending'),
    ('confirmed',  'Confirmed'),
    ('rejected',   'Rejected'),
    ('superseded', 'Superseded by another confirmed suggestion');

CREATE TABLE inquiry_statuses (
    code  text PRIMARY KEY,
    label text NOT NULL
);
INSERT INTO inquiry_statuses (code, label) VALUES
    ('open',      'Open'),
    ('fulfilled', 'Fulfilled'),
    ('cancelled', 'Cancelled');

CREATE TABLE equipment_types (
    code  text PRIMARY KEY,
    label text NOT NULL
);
INSERT INTO equipment_types (code, label) VALUES
    ('light',       'Light'),
    ('flow',        'Flow (powerhead / wavemaker)'),
    ('return_pump', 'Return pump'),
    ('doser',       'Doser'),
    ('skimmer',     'Protein skimmer'),
    ('heater',      'Heater'),
    ('chiller',     'Chiller'),
    ('ato',         'Auto top-off'),
    ('reactor',     'Reactor'),
    ('other',       'Other');

CREATE TABLE husbandry_categories (
    code  text PRIMARY KEY,
    label text NOT NULL
);
INSERT INTO husbandry_categories (code, label) VALUES
    ('alk_supplement', 'Alkalinity supplement'),
    ('ca_supplement',  'Calcium supplement'),
    ('mg_supplement',  'Magnesium supplement'),
    ('amino_acid',     'Amino acid'),
    ('coral_food',     'Coral food / nutrition'),
    ('trace_element',  'Trace element'),
    ('bacteria',       'Bacteria'),
    ('carbon_source',  'Carbon source'),
    ('other',          'Other');

-- Runtime configuration (e.g. the community ID-confirmation vote threshold),
-- kept here rather than hard-coded in application logic.
CREATE TABLE app_settings (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL,
    description text,
    updated_at  timestamptz NOT NULL DEFAULT now()
);
-- Confirmation requires ALL THREE: age, quorum, and net agreement (asymmetric
-- with rejection, which needs only net_votes <= -threshold — rejection has no
-- real side effects and is fully reversible via re-proposing, so it doesn't
-- need the same cautious bar as confirmation, which writes taxon_node_id onto
-- a photo and can create a brand-new taxon_node).
INSERT INTO app_settings (key, value, description) VALUES
    ('id_confirmation_threshold', '3'::jsonb,
     'Net votes (sum of +1/-1) a single suggestion needs, in either direction, to confirm (>=) or reject (<=-N). Rejection needs only this; confirmation also needs the two settings below.'),
    ('id_confirmation_min_hours', '24'::jsonb,
     'Minimum age (hours) of a suggestion before it can auto-confirm — prevents a fast pile-on before the wider community has seen it.'),
    ('id_confirmation_min_votes', '10'::jsonb,
     'Minimum TOTAL votes cast on a single suggestion (not net, not pooled across a photo''s other competing suggestions) before it can auto-confirm — a quorum floor, distinct from net agreement.');

-- =============================================================================
-- 2. Users, external profiles, businesses
-- =============================================================================

CREATE TABLE users (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username            citext NOT NULL UNIQUE,
    email               citext NOT NULL UNIQUE,
    -- Provider-agnostic auth: password_hash for roll-your-own (Argon2id);
    -- auth_provider/external_auth_id for a managed provider. One side is used.
    password_hash       text,
    auth_provider       text,
    external_auth_id    text,
    account_type_code   text NOT NULL REFERENCES account_types(code),
    display_name        text,
    region              text,
    state               text,
    zip                 text,
    visible_to_traders  boolean NOT NULL DEFAULT false,   -- Door 2 opt-in
    preferred_temp_unit char(1) NOT NULL DEFAULT 'F'
                            CHECK (preferred_temp_unit IN ('C', 'F')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz,
    UNIQUE (auth_provider, external_auth_id)
);
CREATE INDEX idx_users_zip ON users (zip);

-- Seeded catalog of known reef communities, for the "Find me on:" row.
CREATE TABLE external_platforms (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                 text NOT NULL UNIQUE,
    display_name         text NOT NULL,
    base_url             text,
    profile_url_template text,   -- optional autofill helper, e.g. '.../members/{handle}'
    feed_url_template    text,   -- reserved: future activity-feed integration
    icon_key             text,
    is_active            boolean NOT NULL DEFAULT true,
    created_at           timestamptz NOT NULL DEFAULT now()
);
INSERT INTO external_platforms (slug, display_name, base_url, profile_url_template) VALUES
    ('reef2reef', 'Reef2Reef', 'https://www.reef2reef.com',
     'https://www.reef2reef.com/members/{handle}');

-- A user may link several external accounts (Level 1: clickable outbound link).
-- profile_url is always stored and is the source of truth for the link.
CREATE TABLE user_external_profiles (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform_id          uuid REFERENCES external_platforms(id),
    custom_platform_name text,               -- used when platform_id IS NULL
    handle               text,
    profile_url          text NOT NULL,
    feed_url             text,               -- reserved: Level 2 (post pulling)
    is_verified          boolean NOT NULL DEFAULT false,  -- reserved: trust badge
    verified_at          timestamptz,        -- reserved
    verification_method  text,               -- reserved
    display_order        integer NOT NULL DEFAULT 0,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    CHECK (platform_id IS NOT NULL OR custom_platform_name IS NOT NULL)
);
CREATE INDEX idx_user_external_profiles_user ON user_external_profiles (user_id);

CREATE TABLE businesses (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id       uuid NOT NULL REFERENCES users(id),
    name                text NOT NULL,
    slug                text NOT NULL UNIQUE,
    subscription_tier   text,          -- pricing tiers TBD (Open Decision)
    subscription_status text,
    external_billing_id text,          -- e.g. Stripe customer id
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz
);

-- Multiple staff logins per business.
CREATE TABLE business_members (
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'staff')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (business_id, user_id)
);

-- =============================================================================
-- 3. Tanks, grid slots
-- =============================================================================

CREATE TABLE tanks (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES users(id),
    business_id    uuid REFERENCES businesses(id),  -- set => retail display tank
    name           text NOT NULL,
    tank_type      text,
    volume         numeric,
    volume_unit    text DEFAULT 'gal',
    established_on date,
    -- Physical dimensions captured at tank creation; drive the grid layout.
    length         numeric,
    width          numeric,
    height         numeric,
    dimension_unit text DEFAULT 'in',
    tier_count     integer NOT NULL DEFAULT 1,   -- 1 => single-tier frag tank; hide Z
    -- Chosen grid layout, recorded once generated (NULL => not yet configured).
    grid_columns   integer,
    grid_rows      integer,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    deleted_at     timestamptz
);
CREATE INDEX idx_tanks_user ON tanks (user_id);
CREATE INDEX idx_tanks_business ON tanks (business_id);

-- A physical placement location. x/y footprint + z tier (z=1 hidden on frag
-- tanks). label is the human coordinate shown in the UI, e.g. 'C5' or 'C5-L2'.
CREATE TABLE grid_slots (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id    uuid NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
    x          integer NOT NULL,
    y          integer NOT NULL,
    z          integer NOT NULL DEFAULT 1,
    label      text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tank_id, x, y, z),
    UNIQUE (tank_id, label)
);

-- =============================================================================
-- 4. Water parameters (pure) & husbandry / regimen layer
-- =============================================================================

-- Append-only. One row per test session. NO freeform user field by design —
-- narrative belongs on the husbandry side. Photos inherit the latest row.
CREATE TABLE parameter_readings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id         uuid NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
    measured_at     timestamptz NOT NULL,
    -- Core five:
    alkalinity_dkh  numeric,
    calcium_ppm     numeric,
    magnesium_ppm   numeric,
    nitrate_ppm     numeric,
    phosphate_ppm   numeric,
    -- Common optional:
    temperature_c   numeric,   -- stored canonical °C; displayed per user pref
    salinity_ppt    numeric,
    ph              numeric,
    ammonia_ppm     numeric,
    nitrite_ppm     numeric,
    created_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);
CREATE INDEX idx_parameter_readings_tank_time
    ON parameter_readings (tank_id, measured_at DESC);

-- Shared, community-moderated catalog so cross-tank aggregation is meaningful
-- (parallels coral_aliases). NOT free-typed per user.
CREATE TABLE husbandry_products (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand                  text NOT NULL,
    product_name           text NOT NULL,
    category_code          text NOT NULL REFERENCES husbandry_categories(code),
    added_by_user_id       uuid REFERENCES users(id),
    moderation_status_code text NOT NULL DEFAULT 'proposed'
                               REFERENCES moderation_statuses(code),
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    UNIQUE (brand, product_name)
);

-- How a tank maintains alk/ca/mg over time (temporal, for coloration overlay).
CREATE TABLE dosing_methods (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id    uuid NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
    element    text NOT NULL CHECK (element IN ('alkalinity', 'calcium', 'magnesium')),
    method     text NOT NULL CHECK (method IN (
                   'two_part', 'balling', 'kalkwasser', 'calcium_reactor',
                   'dosed_supplement', 'water_change_only', 'other')),
    product_id uuid REFERENCES husbandry_products(id),
    started_on date,
    ended_on   date,   -- NULL => currently in use
    notes      text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dosing_methods_tank ON dosing_methods (tank_id);

-- Everything else going into the water over time (amino acids, foods, trace...).
-- Exact dose fields are DESIGNED but deferred in the UI (they churn frequently).
CREATE TABLE tank_additives (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id       uuid NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
    product_id    uuid NOT NULL REFERENCES husbandry_products(id),
    dose_amount   numeric,        -- deferred: e.g. mL
    dose_unit     text,           -- deferred
    days_of_week  smallint[],     -- deferred: ISO 1=Mon .. 7=Sun
    times_per_day smallint,       -- deferred
    frequency_note text,          -- deferred: freeform cadence
    started_on    date,
    ended_on      date,           -- NULL => currently in use
    notes         text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tank_additives_tank ON tank_additives (tank_id);

-- =============================================================================
-- 5. Equipment (with user-defined Low/Med/High setpoints for light & flow)
-- =============================================================================

CREATE TABLE equipment (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id             uuid NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
    equipment_type_code text NOT NULL REFERENCES equipment_types(code),
    brand               text,
    model               text,
    name                text,
    installed_on        date,
    removed_on          date,
    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz
);
CREATE INDEX idx_equipment_tank ON equipment (tank_id);

-- User-defined Low/Med/High for a piece of equipment. Intended for light & flow
-- gear; value is a percent (0-100). Brand-based defaults can seed these later.
CREATE TABLE equipment_levels (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    level        text NOT NULL CHECK (level IN ('low', 'med', 'high')),
    label        text,
    percent      numeric CHECK (percent >= 0 AND percent <= 100),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (equipment_id, level)
);

-- Timestamped log of equipment changes, for overlay on parameter/color graphs.
CREATE TABLE equipment_events (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    event_type   text NOT NULL CHECK (event_type IN (
                     'level_change', 'installed', 'removed', 'adjusted')),
    level_id     uuid REFERENCES equipment_levels(id),
    occurred_at  timestamptz NOT NULL DEFAULT now(),
    notes        text,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_equipment_events_equipment_time
    ON equipment_events (equipment_id, occurred_at DESC);

-- =============================================================================
-- 6. Specimens & photos
-- =============================================================================

-- One row per individual coral. taxon_node_id NULL => unidentified.
CREATE TABLE specimens (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                uuid NOT NULL REFERENCES users(id),
    tank_id                uuid REFERENCES tanks(id),
    grid_slot_id           uuid REFERENCES grid_slots(id),   -- current placement (no history)
    taxon_node_id          uuid,                              -- FK -> taxon_nodes (companion)
    name                   text,                              -- owner's nickname
    acquired_on            date,
    -- The photo chosen to REPRESENT this collection entry — may be anyone's
    -- public photo (a display pick), distinct from coral_photos.specimen_id
    -- below (true provenance: "I took this photo of this exact specimen",
    -- settable only by that photo's own uploader). FK added after coral_photos
    -- is defined later in this file.
    representative_photo_id uuid,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    deleted_at             timestamptz
);
CREATE INDEX idx_specimens_user ON specimens (user_id);
CREATE INDEX idx_specimens_tank ON specimens (tank_id);
CREATE INDEX idx_specimens_taxon ON specimens (taxon_node_id);
-- One specimen per slot; NULL (unplaced) is unrestricted. A move is a single
-- UPDATE of grid_slot_id, so the old slot is vacated automatically — no
-- occupancy-history table (see schema-decisions.md §4).
CREATE UNIQUE INDEX uq_specimens_grid_slot
    ON specimens (grid_slot_id)
    WHERE grid_slot_id IS NOT NULL AND deleted_at IS NULL;

-- Append-only; public by default. Each photo carries an IMMUTABLE denormalized
-- copy of the tank's most recent parameter snapshot (plus a FK to it), so
-- freshness = (taken_at - snapshot_measured_at) is trivial and survives edits.
CREATE TABLE coral_photos (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_user_id       uuid NOT NULL REFERENCES users(id),
    specimen_id            uuid REFERENCES specimens(id),   -- NULL => standalone
    taxon_node_id          uuid,                            -- FK -> taxon_nodes (companion)
    tank_id                uuid REFERENCES tanks(id),
    is_public              boolean NOT NULL DEFAULT true,
    taken_at               timestamptz,
    -- Object storage reference (never the blob). Target not yet chosen.
    storage_provider       text,
    storage_key            text,
    url                    text,
    mime                   text,
    width                  integer,
    height                 integer,
    bytes                  bigint,
    checksum               text,
    -- Immutable parameter snapshot stamped at upload:
    parameter_reading_id   uuid REFERENCES parameter_readings(id),
    snapshot_measured_at   timestamptz,
    snapshot_alkalinity_dkh numeric,
    snapshot_calcium_ppm   numeric,
    snapshot_magnesium_ppm numeric,
    snapshot_nitrate_ppm   numeric,
    snapshot_phosphate_ppm numeric,
    -- Capture context (captured at upload or lost). EXIF is opportunistic and
    -- often stripped/absent, so it is a sparse jsonb rather than typed columns.
    -- It records CAMERA settings, not the tank's light spectrum; the lighting
    -- context below is the stronger reef-specific signal and feeds the
    -- multi-lighting identification diagram.
    capture_metadata       jsonb,   -- EXIF: white balance, exposure, ISO, color space, camera...
    light_equipment_id     uuid REFERENCES equipment(id),        -- the light this was shot under
    light_level_id         uuid REFERENCES equipment_levels(id), -- its Low/Med/High setpoint
    lighting_note          text,    -- free-text fallback when gear isn't logged
    created_at             timestamptz NOT NULL DEFAULT now(),
    deleted_at             timestamptz
);
CREATE INDEX idx_coral_photos_specimen ON coral_photos (specimen_id);
CREATE INDEX idx_coral_photos_taxon ON coral_photos (taxon_node_id);
CREATE INDEX idx_coral_photos_uploader ON coral_photos (uploader_user_id);

ALTER TABLE specimens
    ADD CONSTRAINT fk_specimens_representative_photo
    FOREIGN KEY (representative_photo_id) REFERENCES coral_photos(id);

-- Community engagement on a photo, distinct from identification voting
-- (id_votes below judges a PROPOSED NAME; this judges the PHOTO itself).
-- v1 ships a single, unambiguously-labeled 'accurate' vote ("this is a
-- correct match") used to pick each taxon's hero image. vote_type is schema-
-- ready for a future separate 'like' dimension without a migration — see
-- docs/future-considerations.md.
CREATE TABLE coral_photo_votes (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coral_photo_id uuid NOT NULL REFERENCES coral_photos(id) ON DELETE CASCADE,
    user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type      text NOT NULL DEFAULT 'accurate' CHECK (vote_type IN ('accurate', 'like')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (coral_photo_id, user_id, vote_type)
);
CREATE INDEX idx_coral_photo_votes_photo ON coral_photo_votes (coral_photo_id, vote_type);

-- =============================================================================
-- 7. Identification: aliases, suggestions, votes
-- =============================================================================

-- Alternate hobbyist names for a wiki entry. The SAME trade name may point to
-- several taxon nodes (e.g. "Rainbow"), so uniqueness is per node, not global.
CREATE TABLE coral_aliases (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    taxon_node_id          uuid NOT NULL,          -- FK -> taxon_nodes (companion)
    alias_name             text NOT NULL,
    alias_name_normalized  text NOT NULL,          -- lowercased/trimmed for search
    moderation_status_code text NOT NULL DEFAULT 'proposed'
                               REFERENCES moderation_statuses(code),
    proposed_by_user_id    uuid REFERENCES users(id),
    approved_by_user_id    uuid REFERENCES users(id),
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    UNIQUE (taxon_node_id, alias_name_normalized)
);
CREATE INDEX idx_coral_aliases_taxon ON coral_aliases (taxon_node_id);
CREATE INDEX idx_coral_aliases_norm ON coral_aliases (alias_name_normalized);
CREATE INDEX idx_coral_aliases_trgm
    ON coral_aliases USING gin (alias_name_normalized gin_trgm_ops);

-- A suggestion targets a taxon node at ANY level, proposes a not-yet-existing
-- name against an existing node (an alias claim — see coral_aliases insert in
-- the app layer, deliberately NOT auto-approved by this table's own vote: an
-- alias is a distinct claim from "this photo shows that coral", so it needs
-- its own separate review, not a side effect of this vote), or proposes a
-- brand-new morph (proposed_taxon_id null, proposed_name + proposed_genus_id
-- set — confirming this CREATES a new taxon_node, see handle_id_vote_change
-- below). net_votes is materialized by that trigger; status flips per the
-- app_settings thresholds (asymmetric — see those rows' descriptions).
CREATE TABLE id_suggestions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coral_photo_id      uuid NOT NULL REFERENCES coral_photos(id) ON DELETE CASCADE,
    proposed_taxon_id   uuid,                    -- FK -> taxon_nodes (companion)
    proposed_name       text,                    -- new name: alias OR brand-new morph
    proposed_genus_id   uuid,                    -- FK -> taxon_nodes (companion); required for a brand-new morph
    suggested_by_user_id uuid NOT NULL REFERENCES users(id),
    status_code         text NOT NULL DEFAULT 'pending' REFERENCES id_statuses(code),
    net_votes           integer NOT NULL DEFAULT 0,
    resolved_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (proposed_taxon_id IS NOT NULL OR proposed_name IS NOT NULL),
    -- Defensive: a brand-new-morph proposal (no existing taxon matched) must
    -- carry a genus now, not discover it's missing when the trigger tries to
    -- INSERT the new taxon_node at confirm time, possibly days later.
    CONSTRAINT id_suggestions_new_morph_needs_genus
        CHECK (proposed_taxon_id IS NOT NULL OR proposed_genus_id IS NOT NULL)
);
CREATE INDEX idx_id_suggestions_photo ON id_suggestions (coral_photo_id);
CREATE INDEX idx_id_suggestions_status ON id_suggestions (status_code);

CREATE TABLE id_votes (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_suggestion_id uuid NOT NULL REFERENCES id_suggestions(id) ON DELETE CASCADE,
    user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    value            smallint NOT NULL CHECK (value IN (-1, 1)),
    weight           numeric NOT NULL DEFAULT 1,   -- reserved: trust weighting (Phase 3)
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id_suggestion_id, user_id)
);

-- Recomputes net_votes on every vote change and, once a suggestion clears its
-- resolution bar, applies the real side effects: rejection is cheap and
-- reversible (net_votes <= -threshold, no floors — see app_settings), so it
-- just flips status. Confirmation has real, harder-to-undo side effects (sets
-- coral_photos.taxon_node_id, may CREATE a new taxon_node), so it requires
-- ALL THREE of: minimum age, a total-vote quorum measured on THIS suggestion
-- alone (never pooled across a photo's other competing suggestions), and net
-- agreement. Runs SECURITY DEFINER because an ordinary voter otherwise has no
-- privilege to insert into taxon_nodes or update another user's coral_photos
-- row — the same justification as handle_new_user() elsewhere in this file.
-- Timing note: since this only runs when a vote is cast (no scheduled job by
-- design — see docs/schema-decisions.md's live-computation preference), a
-- suggestion that clears the age floor while voting has gone quiet won't flip
-- until the NEXT vote arrives. Accepted trade-off; exact-timing would need a
-- real scheduled job (e.g. pg_cron), not introduced here.
CREATE OR REPLACE FUNCTION handle_id_vote_change() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_suggestion_id uuid := COALESCE(NEW.id_suggestion_id, OLD.id_suggestion_id);
    v_photo_id      uuid;
    v_proposed_taxon uuid;
    v_proposed_name  text;
    v_proposed_genus uuid;
    v_status         text;
    v_created        timestamptz;
    v_net            integer;
    v_total          integer;
    v_threshold      integer;
    v_min_hours      numeric;
    v_min_votes      integer;
    v_final_taxon    uuid;
    v_base_slug      text;
    v_slug           text;
    v_suffix         integer := 1;
BEGIN
    SELECT coral_photo_id, proposed_taxon_id, proposed_name, proposed_genus_id,
           status_code, created_at
        INTO v_photo_id, v_proposed_taxon, v_proposed_name, v_proposed_genus,
             v_status, v_created
        FROM id_suggestions WHERE id = v_suggestion_id FOR UPDATE;

    SELECT COALESCE(SUM(value), 0), COUNT(*) INTO v_net, v_total
        FROM id_votes WHERE id_suggestion_id = v_suggestion_id;
    UPDATE id_suggestions SET net_votes = v_net WHERE id = v_suggestion_id;

    -- Already resolved: net_votes stays cosmetically in sync (above), but no
    -- further action — status doesn't change once confirmed/rejected/superseded.
    IF v_status <> 'pending' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- value is a scalar jsonb (e.g. 3, not [3]) — #>>'{}' extracts a scalar as
    -- text regardless of its JSON type; ->>0 would be for a JSON array.
    SELECT (value #>> '{}')::integer INTO v_threshold
        FROM app_settings WHERE key = 'id_confirmation_threshold';
    SELECT (value #>> '{}')::numeric INTO v_min_hours
        FROM app_settings WHERE key = 'id_confirmation_min_hours';
    SELECT (value #>> '{}')::integer INTO v_min_votes
        FROM app_settings WHERE key = 'id_confirmation_min_votes';

    IF v_net <= -v_threshold THEN
        UPDATE id_suggestions SET status_code = 'rejected', resolved_at = now()
            WHERE id = v_suggestion_id;
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF v_total >= v_min_votes
       AND v_net >= v_threshold
       AND EXTRACT(EPOCH FROM (now() - v_created)) / 3600 >= v_min_hours
    THEN
        IF v_proposed_taxon IS NOT NULL THEN
            v_final_taxon := v_proposed_taxon;
        ELSE
            v_base_slug := trim(both '-' from
                regexp_replace(lower(trim(v_proposed_name)), '[^a-z0-9]+', '-', 'g'));
            v_slug := v_base_slug;
            WHILE EXISTS (SELECT 1 FROM taxon_nodes WHERE slug = v_slug) LOOP
                v_suffix := v_suffix + 1;
                v_slug := v_base_slug || '-' || v_suffix;
            END LOOP;
            INSERT INTO taxon_nodes (parent_id, rank_code, name, slug)
                VALUES (v_proposed_genus, 'morph', v_proposed_name, v_slug)
                RETURNING id INTO v_final_taxon;
        END IF;

        UPDATE coral_photos SET taxon_node_id = v_final_taxon WHERE id = v_photo_id;
        UPDATE id_suggestions
            SET status_code = 'confirmed', resolved_at = now(), proposed_taxon_id = v_final_taxon
            WHERE id = v_suggestion_id;

        -- This photo now has an answer — stop asking for votes on its other
        -- competing (still-pending) proposed names.
        UPDATE id_suggestions SET status_code = 'superseded', resolved_at = now()
            WHERE coral_photo_id = v_photo_id
              AND id <> v_suggestion_id
              AND status_code = 'pending';
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_id_votes_recompute ON id_votes;
CREATE TRIGGER trg_id_votes_recompute
    AFTER INSERT OR UPDATE OR DELETE ON id_votes
    FOR EACH ROW EXECUTE FUNCTION handle_id_vote_change();

-- =============================================================================
-- 8. Provenance (protected, private by default)
-- =============================================================================

-- Chain-of-custody. A source may be a prior specimen, a business, a user, or
-- free text/unknown. Private by default; expected to be incomplete. Single
-- source per specimen for now, but its own table so it can go many-to-many.
CREATE TABLE provenance_records (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    specimen_id        uuid NOT NULL REFERENCES specimens(id) ON DELETE CASCADE,
    source_specimen_id uuid REFERENCES specimens(id),
    source_business_id uuid REFERENCES businesses(id),
    source_user_id     uuid REFERENCES users(id),
    source_note        text,
    visibility         text NOT NULL DEFAULT 'private'
                           CHECK (visibility IN ('private', 'public')),
    acquired_on        date,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    deleted_at         timestamptz,
    CHECK (source_specimen_id IS NOT NULL OR source_business_id IS NOT NULL
           OR source_user_id IS NOT NULL OR source_note IS NOT NULL)
);
CREATE INDEX idx_provenance_specimen ON provenance_records (specimen_id);

-- =============================================================================
-- 9. Retail: QR codes, inquiries
-- =============================================================================

-- One QR per grid slot, generated once and reused forever (never reprinted).
-- The public page resolves slot -> whatever specimen currently occupies it.
CREATE TABLE qr_codes (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    grid_slot_id uuid NOT NULL UNIQUE REFERENCES grid_slots(id) ON DELETE CASCADE,
    code         text NOT NULL UNIQUE,   -- token embedded in the QR URL
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- "I'm interested" taps from a QR scan. Never a transaction. Anonymous-capable.
-- In the schema for the future; the flow is not built in the current phase.
CREATE TABLE inquiries (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    grid_slot_id  uuid REFERENCES grid_slots(id),
    specimen_id   uuid REFERENCES specimens(id),
    user_id       uuid REFERENCES users(id),   -- NULL => anonymous
    contact_name  text,
    contact_email text,
    contact_phone text,
    message       text,
    status_code   text NOT NULL DEFAULT 'open' REFERENCES inquiry_statuses(code),
    fulfilled_at  timestamptz,   -- fulfilling w/ a known buyer can trigger lineage
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inquiries_business ON inquiries (business_id);
CREATE INDEX idx_inquiries_status ON inquiries (status_code);

-- =============================================================================
-- 10. Community: want list, affiliate links, notifications
-- =============================================================================

CREATE TABLE want_list (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    taxon_node_id uuid NOT NULL,          -- FK -> taxon_nodes (companion)
    note          text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, taxon_node_id)
);

-- Outbound vendor/farmer links attach to a PHOTO: many vendors compete on the
-- same coral by showcasing their own photo. Wiki pages aggregate by taxon via
-- the photo. No payment handled on-platform.
CREATE TABLE affiliate_links (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coral_photo_id uuid NOT NULL REFERENCES coral_photos(id) ON DELETE CASCADE,
    business_id    uuid REFERENCES businesses(id),
    vendor_name    text NOT NULL,
    url            text NOT NULL,
    referral_code  text,
    is_active      boolean NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    deleted_at     timestamptz
);
CREATE INDEX idx_affiliate_links_photo ON affiliate_links (coral_photo_id);

-- Lightweight outbound-click log for commission reconciliation and ranking.
-- Privacy-conscious: hashed IP only, no raw PII.
CREATE TABLE affiliate_clicks (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_link_id uuid NOT NULL REFERENCES affiliate_links(id) ON DELETE CASCADE,
    clicked_at        timestamptz NOT NULL DEFAULT now(),
    user_id           uuid REFERENCES users(id),
    ip_hash           text,
    referrer          text
);
CREATE INDEX idx_affiliate_clicks_link_time
    ON affiliate_clicks (affiliate_link_id, clicked_at DESC);

CREATE TABLE notifications (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       text NOT NULL,
    payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
    read_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread
    ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;

-- =============================================================================
-- 11. Messaging (STUBBED — tables only; feature deferred to Phase 4)
-- =============================================================================
-- First real version will be constrained to match-initiated 1:1 threads to keep
-- the abuse surface small. Tables exist now so want-list matches can reference
-- them without a later migration.

CREATE TABLE conversations (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    context_type text,     -- e.g. 'want_list_match'
    context_id   uuid,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversation_participants (
    conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at    timestamptz,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       uuid NOT NULL REFERENCES users(id),
    body            text NOT NULL,
    sent_at         timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON messages (conversation_id, sent_at);

-- =============================================================================
-- 12. Geo foundation (store now, radius search built in Phase 4)
-- =============================================================================

CREATE TABLE zip_geo (
    zip       text PRIMARY KEY,
    latitude  numeric,
    longitude numeric,
    city      text,
    state     text
);

-- =============================================================================
-- 13. updated_at triggers
-- =============================================================================

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'users', 'user_external_profiles', 'businesses', 'tanks', 'specimens',
        'husbandry_products', 'dosing_methods', 'tank_additives', 'equipment',
        'equipment_levels', 'coral_aliases', 'id_suggestions', 'id_votes',
        'provenance_records', 'inquiries', 'want_list', 'affiliate_links'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON %1$I '
            'FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
    END LOOP;
END $$;

-- =============================================================================
-- 14. Cross-schema foreign keys  (REQUIRES coral_trait_schema.sql)
-- =============================================================================
-- These reference taxon_nodes, which is defined in the companion file. Apply
-- coral_trait_schema.sql FIRST, then this file; this section then validates.
-- If you are applying this file standalone before the companion exists, comment
-- this section out — every table above is otherwise fully self-contained.

ALTER TABLE specimens
    ADD CONSTRAINT fk_specimens_taxon
    FOREIGN KEY (taxon_node_id) REFERENCES taxon_nodes(id);

ALTER TABLE coral_photos
    ADD CONSTRAINT fk_coral_photos_taxon
    FOREIGN KEY (taxon_node_id) REFERENCES taxon_nodes(id);

ALTER TABLE coral_aliases
    ADD CONSTRAINT fk_coral_aliases_taxon
    FOREIGN KEY (taxon_node_id) REFERENCES taxon_nodes(id);

ALTER TABLE id_suggestions
    ADD CONSTRAINT fk_id_suggestions_taxon
    FOREIGN KEY (proposed_taxon_id) REFERENCES taxon_nodes(id);

ALTER TABLE id_suggestions
    ADD CONSTRAINT fk_id_suggestions_genus
    FOREIGN KEY (proposed_genus_id) REFERENCES taxon_nodes(id);

ALTER TABLE want_list
    ADD CONSTRAINT fk_want_list_taxon
    FOREIGN KEY (taxon_node_id) REFERENCES taxon_nodes(id);

-- =============================================================================
-- End of reef-platform-schema.sql
-- =============================================================================
