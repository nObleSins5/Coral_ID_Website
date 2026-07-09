-- =============================================================================
-- Supabase layer — Route a confirmed ID back to the specimen (13_specimen_id_routeback.sql)
-- =============================================================================
-- Incremental migration for an already-live project: replaces
-- handle_id_vote_change() (sql/reef-platform-schema.sql §6) with one addition.
--
-- Gap: a specimen can carry a photo (coral_photos.specimen_id) that started
-- out unidentified — the owner gave it a private nickname, no taxon_node_id.
-- When that photo's identification gets community-confirmed, the ORIGINAL
-- trigger only updated coral_photos.taxon_node_id; the specimen itself never
-- found out and stayed stranded with just its nickname forever. This adds one
-- UPDATE so the specimen's taxon_node_id gets set the moment its photo is
-- confirmed — the nickname (specimens.name) is deliberately left untouched,
-- so the user keeps their personal label alongside the now-real coral link.
-- Guarded by "taxon_node_id IS NULL" so an already-linked specimen (shouldn't
-- happen, but just in case) is never clobbered.
-- Idempotent (CREATE OR REPLACE).
-- =============================================================================

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

        -- NEW: route the confirmed ID back to any specimen this photo is
        -- attached to, so a private/nicknamed specimen stops being stranded
        -- the moment the community confirms it. Nickname is left alone.
        UPDATE specimens SET taxon_node_id = v_final_taxon
            WHERE id = (SELECT specimen_id FROM coral_photos WHERE id = v_photo_id)
              AND taxon_node_id IS NULL;

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
