-- =============================================================================
-- Supabase layer — Photo votes: table + RLS (07_photo_votes.sql)
-- =============================================================================
-- Incremental migration for an already-live project: mirrors the
-- coral_photo_votes table added to sql/reef-platform-schema.sql (§6) so a
-- from-scratch install and this already-provisioned project stay in sync.
-- Idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS coral_photo_votes (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coral_photo_id uuid NOT NULL REFERENCES coral_photos(id) ON DELETE CASCADE,
    user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type      text NOT NULL DEFAULT 'accurate' CHECK (vote_type IN ('accurate', 'like')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (coral_photo_id, user_id, vote_type)
);
CREATE INDEX IF NOT EXISTS idx_coral_photo_votes_photo
    ON coral_photo_votes (coral_photo_id, vote_type);

ALTER TABLE coral_photo_votes ENABLE ROW LEVEL SECURITY;

-- Public read: needed to count votes and pick each taxon's hero photo.
DROP POLICY IF EXISTS coral_photo_votes_public_read ON coral_photo_votes;
CREATE POLICY coral_photo_votes_public_read ON coral_photo_votes
    FOR SELECT TO anon, authenticated USING (true);

-- Owner-scoped write: cast/retract only your own vote (toggle = insert/delete).
DROP POLICY IF EXISTS coral_photo_votes_owner_insert ON coral_photo_votes;
CREATE POLICY coral_photo_votes_owner_insert ON coral_photo_votes
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS coral_photo_votes_owner_delete ON coral_photo_votes;
CREATE POLICY coral_photo_votes_owner_delete ON coral_photo_votes
    FOR DELETE TO authenticated USING (user_id = auth.uid());
