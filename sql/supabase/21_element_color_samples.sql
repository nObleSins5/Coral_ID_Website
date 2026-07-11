-- =============================================================================
-- Supabase layer — Community element color samples (21_element_color_samples.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the same
-- table/settings/RLS in sql/reef-platform-schema.sql.
--
-- The color-picker tool (docs/future-considerations.md, "improving /identify"
-- step 2) lets a user sample the real hex of each coral element off a photo.
-- Those contributed samples are a RAW LOG, kept separate from the published
-- color_stops the wiki displays — because a color sampled on the wrong coral
-- would otherwise pollute the documented range (product decision 2026-07-11).
--
-- Lifecycle (status):
--   proposed  — just submitted, or checked-but-not-yet-trusted.
--   confirmed — agrees with the documented range (ΔE within threshold) on a
--               settled taxon, OR a moderator approved it.
--   rejected  — a moderator (or the range check flagging it out_of_range,
--               then a moderator) rejected it.
-- delta_e / out_of_range are recorded at submit time by the app's CIELAB
-- range check (web/lib/color.ts) against the element's existing documented
-- colors; a sample too far out is held as a likely-miss for review rather
-- than auto-confirmed. Both raw_hex and corrected_hex are retained so the
-- white-balance correction can be re-run/improved later without re-sampling.
-- Idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS element_color_samples (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    taxon_node_id       uuid NOT NULL REFERENCES taxon_nodes(id) ON DELETE CASCADE,
    element_type_code   text NOT NULL REFERENCES element_types(code),
    coral_photo_id      uuid REFERENCES coral_photos(id) ON DELETE SET NULL,
    raw_hex             text NOT NULL CHECK (raw_hex ~ '^#[0-9A-Fa-f]{6}$'),
    corrected_hex       text CHECK (corrected_hex ~ '^#[0-9A-Fa-f]{6}$'),
    used_hex            text NOT NULL CHECK (used_hex ~ '^#[0-9A-Fa-f]{6}$'),
    wb_reference_material text,
    wb_gain_r           numeric,
    wb_gain_g           numeric,
    wb_gain_b           numeric,
    sample_x            numeric CHECK (sample_x >= 0 AND sample_x <= 1),
    sample_y            numeric CHECK (sample_y >= 0 AND sample_y <= 1),
    delta_e             numeric,
    out_of_range        boolean NOT NULL DEFAULT false,
    status              text NOT NULL DEFAULT 'proposed'
                            CHECK (status IN ('proposed', 'confirmed', 'rejected')),
    submitted_by_user_id uuid NOT NULL REFERENCES users(id),
    reviewed_by_user_id  uuid REFERENCES users(id),
    reviewed_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_element_color_samples_taxon
    ON element_color_samples (taxon_node_id, element_type_code, status);

INSERT INTO app_settings (key, value, description) VALUES
    ('color_sample_delta_e_threshold', '30'::jsonb,
     'Max CIELAB ΔE76 a submitted color sample may be from an element''s documented colors to auto-confirm on a settled taxon; beyond this it is held as a likely-miss (out_of_range) for moderator review.')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE element_color_samples ENABLE ROW LEVEL SECURITY;

-- Public sees confirmed samples (they surface in the element color key).
DROP POLICY IF EXISTS element_color_samples_public_read ON public.element_color_samples;
CREATE POLICY element_color_samples_public_read ON public.element_color_samples
    FOR SELECT TO anon, authenticated
    USING (status = 'confirmed');

-- A submitter can see their own, whatever the status.
DROP POLICY IF EXISTS element_color_samples_owner_read ON public.element_color_samples;
CREATE POLICY element_color_samples_owner_read ON public.element_color_samples
    FOR SELECT TO authenticated
    USING (submitted_by_user_id = auth.uid());

-- Moderators see everything (for the /moderate review queue).
DROP POLICY IF EXISTS element_color_samples_moderator_read ON public.element_color_samples;
CREATE POLICY element_color_samples_moderator_read ON public.element_color_samples
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator));

-- Anyone authenticated may submit their own samples. Status/delta_e are set by
-- the server action, not trusted from the client; RLS only guarantees the
-- submitter is the caller.
DROP POLICY IF EXISTS element_color_samples_auth_insert ON public.element_color_samples;
CREATE POLICY element_color_samples_auth_insert ON public.element_color_samples
    FOR INSERT TO authenticated
    WITH CHECK (submitted_by_user_id = auth.uid());

-- Moderators approve/reject.
DROP POLICY IF EXISTS element_color_samples_moderator_update ON public.element_color_samples;
CREATE POLICY element_color_samples_moderator_update ON public.element_color_samples
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator))
    WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator));
