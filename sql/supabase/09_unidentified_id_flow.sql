-- =============================================================================
-- Supabase layer — Unidentified-ID flow (09_unidentified_id_flow.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the
-- id_suggestions/id_votes/id_statuses/app_settings changes in
-- sql/reef-platform-schema.sql (the "superseded" status, the two new
-- confirmation thresholds, proposed_genus_id, the new defensive CHECK, and
-- the handle_id_vote_change trigger), plus widens id_suggestions/id_votes
-- read access to anon (previously authenticated-only) so logged-out visitors
-- can browse the identification queue — proposing and voting stay
-- authenticated-only, unchanged. Idempotent.
-- =============================================================================

INSERT INTO id_statuses (code, label) VALUES
    ('superseded', 'Superseded by another confirmed suggestion')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings (key, value, description) VALUES
    ('id_confirmation_min_hours', '24'::jsonb,
     'Minimum age (hours) of a suggestion before it can auto-confirm — prevents a fast pile-on before the wider community has seen it.'),
    ('id_confirmation_min_votes', '10'::jsonb,
     'Minimum TOTAL votes cast on a single suggestion (not net, not pooled across a photo''s other competing suggestions) before it can auto-confirm — a quorum floor, distinct from net agreement.')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE id_suggestions
    ADD COLUMN IF NOT EXISTS proposed_genus_id uuid REFERENCES taxon_nodes(id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'id_suggestions_new_morph_needs_genus'
    ) THEN
        ALTER TABLE id_suggestions
            ADD CONSTRAINT id_suggestions_new_morph_needs_genus
            CHECK (proposed_taxon_id IS NOT NULL OR proposed_genus_id IS NOT NULL);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_id_suggestions_genus'
    ) THEN
        ALTER TABLE id_suggestions
            ADD CONSTRAINT fk_id_suggestions_genus
            FOREIGN KEY (proposed_genus_id) REFERENCES taxon_nodes(id);
    END IF;
END $$;

-- See sql/reef-platform-schema.sql for the extended rationale comment.
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

    IF v_status <> 'pending' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

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

-- Widen read access to anon (was authenticated-only) — browsing the queue
-- should not require login; proposing/voting still do (unchanged policies).
DROP POLICY IF EXISTS id_suggestions_auth_read ON public.id_suggestions;
CREATE POLICY id_suggestions_public_read ON public.id_suggestions
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS id_votes_auth_read ON public.id_votes;
CREATE POLICY id_votes_public_read ON public.id_votes
    FOR SELECT TO anon, authenticated USING (true);
