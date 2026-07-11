-- =============================================================================
-- Supabase layer — Row-Level Security policies (02_rls_policies.sql)
-- =============================================================================
-- Apply AFTER the core schema files and 01_auth_integration.sql.
--
-- Without RLS, the public anon key exposes every table. This file:
--   1. Enables RLS on EVERY public table (default-deny — nothing is readable or
--      writable until a policy grants it).
--   2. Grants PUBLIC READ to the wiki / reference / SEO surface.
--   3. Grants OWNER-SCOPED access to the Phase 0 vertical-slice tables
--      (users, tanks + children, specimens, photos, want list, notifications).
--   4. Grants AUTHENTICATED access to community identification (suggestions,
--      votes, catalog proposals).
--
-- Deferred-feature tables (businesses, business_members, inquiries,
-- affiliate_clicks, messaging, app_settings) are left RLS-on with NO policy on
-- purpose: they are reachable only by the service role until those features are
-- built and get their own reviewed policies. `auth.uid()` is Supabase's current
-- user id; `anon` / `authenticated` are Supabase's built-in roles.
-- =============================================================================

-- 1. Default-deny: enable RLS on every table in the public schema.
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    END LOOP;
END $$;

-- 2. Public read — reference / lookup / wiki / SEO surface.
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        -- platform lookups
        'account_types','moderation_statuses','id_statuses','inquiry_statuses',
        'equipment_types','husbandry_categories','external_platforms',
        -- trait lookups
        'ranks','element_types','growth_forms','care_difficulties','care_levels',
        'corallite_shapes','skin_textures','polyp_sizes','color_patterns','named_colors',
        -- wiki content
        'taxon_nodes','element_profiles','color_ranges','color_stops',
        'taxon_reference_images','taxon_recommended_products',
        -- public utility
        'qr_codes','zip_geo'
    ])
    LOOP
        EXECUTE format(
            'CREATE POLICY %1$s_public_read ON public.%1$I '
            'FOR SELECT TO anon, authenticated USING (true);', t);
    END LOOP;
END $$;

-- 3. Conditional public read (only the rows meant to be public).
CREATE POLICY coral_photos_public_read ON public.coral_photos
    FOR SELECT TO anon, authenticated
    USING (is_public AND deleted_at IS NULL);

CREATE POLICY coral_aliases_public_read ON public.coral_aliases
    FOR SELECT TO anon, authenticated
    USING (moderation_status_code = 'approved');

CREATE POLICY husbandry_products_public_read ON public.husbandry_products
    FOR SELECT TO anon, authenticated
    USING (moderation_status_code = 'approved');

CREATE POLICY affiliate_links_public_read ON public.affiliate_links
    FOR SELECT TO anon, authenticated
    USING (is_active AND deleted_at IS NULL AND NOT hidden_by_owner);

-- External profiles are meant to be shown ("Find me on: ..."); public read.
CREATE POLICY user_external_profiles_public_read ON public.user_external_profiles
    FOR SELECT TO anon, authenticated USING (true);

-- 4. Owner-scoped: users profile (self read/update; insert handled by the signup
--    trigger, which runs as SECURITY DEFINER and bypasses RLS).
CREATE POLICY users_select_self ON public.users
    FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY users_update_self ON public.users
    FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Directly user-owned tables (user_id = auth.uid()).
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'tanks','specimens','want_list','notifications','user_external_profiles'
    ])
    LOOP
        EXECUTE format(
            'CREATE POLICY %1$s_owner_all ON public.%1$I '
            'FOR ALL TO authenticated '
            'USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());', t);
    END LOOP;
END $$;

-- Tank-scoped tables (owned via the parent tank).
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'grid_slots','parameter_readings','equipment','dosing_methods','tank_additives'
    ])
    LOOP
        EXECUTE format(
            'CREATE POLICY %1$s_owner_all ON public.%1$I '
            'FOR ALL TO authenticated '
            'USING (tank_id IN (SELECT id FROM public.tanks WHERE user_id = auth.uid())) '
            'WITH CHECK (tank_id IN (SELECT id FROM public.tanks WHERE user_id = auth.uid()));', t);
    END LOOP;
END $$;

-- Equipment-scoped tables (owned via equipment -> tank).
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['equipment_levels','equipment_events'])
    LOOP
        EXECUTE format(
            'CREATE POLICY %1$s_owner_all ON public.%1$I '
            'FOR ALL TO authenticated USING (equipment_id IN ('
            '  SELECT e.id FROM public.equipment e JOIN public.tanks t ON t.id = e.tank_id '
            '  WHERE t.user_id = auth.uid())) '
            'WITH CHECK (equipment_id IN ('
            '  SELECT e.id FROM public.equipment e JOIN public.tanks t ON t.id = e.tank_id '
            '  WHERE t.user_id = auth.uid()));', t);
    END LOOP;
END $$;

-- Specimen-scoped: provenance (owned via the specimen). Private by default.
CREATE POLICY provenance_owner_all ON public.provenance_records
    FOR ALL TO authenticated
    USING (specimen_id IN (SELECT id FROM public.specimens WHERE user_id = auth.uid()))
    WITH CHECK (specimen_id IN (SELECT id FROM public.specimens WHERE user_id = auth.uid()));

-- Photos: public read is above; writes are by the uploader.
CREATE POLICY coral_photos_owner_write ON public.coral_photos
    FOR ALL TO authenticated
    USING (uploader_user_id = auth.uid())
    WITH CHECK (uploader_user_id = auth.uid());

-- 5. Community identification: any authenticated user participates.
CREATE POLICY id_suggestions_auth_read ON public.id_suggestions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY id_suggestions_auth_insert ON public.id_suggestions
    FOR INSERT TO authenticated WITH CHECK (suggested_by_user_id = auth.uid());

CREATE POLICY id_votes_auth_read ON public.id_votes
    FOR SELECT TO authenticated USING (true);
CREATE POLICY id_votes_owner_write ON public.id_votes
    FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Catalog / alias proposals (moderated; public read of approved rows is above).
CREATE POLICY husbandry_products_auth_insert ON public.husbandry_products
    FOR INSERT TO authenticated WITH CHECK (added_by_user_id = auth.uid());

CREATE POLICY coral_aliases_auth_insert ON public.coral_aliases
    FOR INSERT TO authenticated WITH CHECK (proposed_by_user_id = auth.uid());

-- Moderator review of proposed/rejected rows (users.is_moderator — see
-- sql/supabase/14_alias_moderation.sql). Additional, OR'd SELECT policy on
-- top of the *_public_read policies above, which only cover 'approved' rows.
CREATE POLICY coral_aliases_moderator_read ON public.coral_aliases
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator));
CREATE POLICY coral_aliases_moderator_update ON public.coral_aliases
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator))
    WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator));

CREATE POLICY husbandry_products_moderator_read ON public.husbandry_products
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator));
CREATE POLICY husbandry_products_moderator_update ON public.husbandry_products
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator))
    WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_moderator));

-- A user can read back their OWN proposed product (not yet approved, so the
-- public_read policy above doesn't cover it) — needed so husbandry/equipment
-- logging can display a just-proposed product's name immediately, not just
-- once a moderator approves it. sql/supabase/17_husbandry_logging.sql.
CREATE POLICY husbandry_products_owner_read ON public.husbandry_products
    FOR SELECT TO authenticated
    USING (added_by_user_id = auth.uid());

-- Affiliate links: owner-write, scoped via the underlying photo (only the
-- photo's own uploader manages links on it — see 11_affiliate_links.sql) AND
-- restricted to business-tier accounts (12_business_listings.sql, 2026-07 —
-- affiliate links became a business-only feature; hobbyist-to-hobbyist trade
-- flagging is a separate, not-yet-built feature). Public read of active,
-- non-hidden links is granted above (affiliate_links_public_read); this is a
-- second, independent policy so the owner can also see/manage their own
-- inactive (deactivated / reported-off) or hidden links.
CREATE POLICY affiliate_links_owner_write ON public.affiliate_links
    FOR ALL TO authenticated
    USING (
        coral_photo_id IN (SELECT id FROM public.coral_photos WHERE uploader_user_id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND account_type_code = 'business')
    )
    WITH CHECK (
        coral_photo_id IN (SELECT id FROM public.coral_photos WHERE uploader_user_id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND account_type_code = 'business')
    );

CREATE POLICY affiliate_link_reports_insert ON public.affiliate_link_reports
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY affiliate_link_reports_select_own ON public.affiliate_link_reports
    FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Click-log insert (append-only; no SELECT policy — reconciliation is a
-- service-role/admin concern, not exposed to the app).
CREATE POLICY affiliate_clicks_insert ON public.affiliate_clicks
    FOR INSERT TO anon, authenticated WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- =============================================================================
-- Intentionally left RLS-on with NO policy (service-role only until built):
--   app_settings, businesses, business_members, inquiries,
--   conversations, conversation_participants, messages.
-- Add reviewed policies when those features are implemented.
-- =============================================================================
