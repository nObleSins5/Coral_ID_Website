-- =============================================================================
-- Supabase layer — Moderator manual-confirm for pending morph proposals (33_moderator_confirm_suggestion.sql)
-- =============================================================================
-- Community proposals already auto-confirm once a suggestion clears
-- id_confirmation_threshold/_min_votes/_min_hours (handle_id_vote_change,
-- sql/supabase/09_unidentified_id_flow.sql + specimens routeback added in
-- sql/supabase/13_specimen_id_routeback.sql). This adds the moderator
-- fast-path: confirm a still-pending proposal immediately, same outcome as
-- auto-confirm, without waiting on votes/age.
--
-- The taxon-creation/photo-update/supersede logic is extracted out of
-- handle_id_vote_change into confirm_id_suggestion() so the trigger (auto
-- path) and moderator_confirm_suggestion() (manual path) share one
-- implementation instead of two copies that can drift. handle_id_vote_change
-- keeps its own threshold checks and just calls confirm_id_suggestion() once
-- they're met — no behavior change there.
-- Idempotent (CREATE OR REPLACE), matching every prior numbered migration.
-- =============================================================================

CREATE OR REPLACE FUNCTION confirm_id_suggestion(p_suggestion_id uuid) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_photo_id       uuid;
    v_proposed_taxon uuid;
    v_proposed_name  text;
    v_proposed_genus uuid;
    v_final_taxon    uuid;
    v_base_slug      text;
    v_slug           text;
    v_suffix         integer := 1;
BEGIN
    SELECT coral_photo_id, proposed_taxon_id, proposed_name, proposed_genus_id
        INTO v_photo_id, v_proposed_taxon, v_proposed_name, v_proposed_genus
        FROM id_suggestions WHERE id = p_suggestion_id;

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

    UPDATE specimens SET taxon_node_id = v_final_taxon
        WHERE id = (SELECT specimen_id FROM coral_photos WHERE id = v_photo_id)
          AND taxon_node_id IS NULL;

    UPDATE id_suggestions
        SET status_code = 'confirmed', resolved_at = now(), proposed_taxon_id = v_final_taxon
        WHERE id = p_suggestion_id;

    UPDATE id_suggestions SET status_code = 'superseded', resolved_at = now()
        WHERE coral_photo_id = v_photo_id
          AND id <> p_suggestion_id
          AND status_code = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION handle_id_vote_change() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_suggestion_id uuid := COALESCE(NEW.id_suggestion_id, OLD.id_suggestion_id);
    v_status         text;
    v_created        timestamptz;
    v_net            integer;
    v_total          integer;
    v_threshold      integer;
    v_min_hours      numeric;
    v_min_votes      integer;
BEGIN
    SELECT status_code, created_at INTO v_status, v_created
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
        PERFORM confirm_id_suggestion(v_suggestion_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_id_votes_recompute ON id_votes;
CREATE TRIGGER trg_id_votes_recompute
    AFTER INSERT OR UPDATE OR DELETE ON id_votes
    FOR EACH ROW EXECUTE FUNCTION handle_id_vote_change();

-- Moderator manual fast-path — same outcome as auto-confirm above, callable
-- from the app via supabase.rpc('moderator_confirm_suggestion', ...). Gate
-- mirrors color_ranges_moderator_write (sql/supabase/27_color_moderation.sql):
-- users.is_moderator, independent of account_type_code.
CREATE OR REPLACE FUNCTION moderator_confirm_suggestion(p_suggestion_id uuid) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_moderator) THEN
        RAISE EXCEPTION 'Only moderators can confirm proposals';
    END IF;

    SELECT status_code INTO v_status FROM id_suggestions WHERE id = p_suggestion_id FOR UPDATE;
    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Suggestion not found';
    END IF;
    IF v_status <> 'pending' THEN
        RAISE EXCEPTION 'Suggestion is no longer pending';
    END IF;

    PERFORM confirm_id_suggestion(p_suggestion_id);

    RETURN (SELECT proposed_taxon_id FROM id_suggestions WHERE id = p_suggestion_id);
END;
$$;

GRANT EXECUTE ON FUNCTION moderator_confirm_suggestion(uuid) TO authenticated;

-- confirm_id_suggestion is an internal helper only meant to be called from
-- handle_id_vote_change (trigger context) and moderator_confirm_suggestion
-- (which does its own is_moderator check) — both SECURITY DEFINER, so they
-- retain the ability to call it as its owner regardless of these grants.
-- Postgres grants EXECUTE to PUBLIC by default on function creation, which
-- would otherwise let anon/authenticated call it directly via PostgREST and
-- force-confirm any pending suggestion, skipping the moderator gate entirely.
REVOKE EXECUTE ON FUNCTION confirm_id_suggestion(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION confirm_id_suggestion(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION confirm_id_suggestion(uuid) FROM authenticated;
