-- =============================================================================
-- Supabase layer — International location capture (31_international_location.sql)
-- =============================================================================
-- Reshapes user location from a US-only free-text model (region / state / zip)
-- to an international one keyed on an ISO 3166-1 country code plus a
-- format-agnostic postal code. Rationale:
--   * country_code is the one location fact that cannot be derived from
--     anything else, so it is captured (required in the app) at signup.
--   * "zip" is renamed to postal_code — postal codes are near-universal and
--     the best privacy-preserving location proxy (they geocode to a town/
--     district CENTROID, never a street address).
--   * latitude/longitude are added but left NULL — they are SYSTEM-derived
--     later from (country_code, postal_code) via an offline dataset
--     (e.g. GeoNames), never entered by the user. Storing them here keeps the
--     schema ready for the future regional trade-matching feature
--     (visible_to_traders already gates opt-in).
--   * the vague free-text "region" column is dropped (redundant once country
--     + postal are captured; nothing reads it).
-- Idempotent; safe to re-run.
-- =============================================================================

-- 1. New country_code column (ISO 3166-1 alpha-2). Nullable at the DB layer
--    (the only insert path is the handle_new_user trigger); the signup form
--    and server action enforce presence + validity. A lightweight CHECK keeps
--    obviously-malformed values out without pinning the full ISO list in SQL.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS country_code text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_country_code_format'
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_country_code_format
            CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');
    END IF;
END $$;

-- 2. Rename zip -> postal_code (guarded so re-runs are no-ops).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'zip'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'postal_code'
    ) THEN
        ALTER TABLE public.users RENAME COLUMN zip TO postal_code;
    END IF;
END $$;

-- 3. System-derived coordinates (populated later from country + postal code,
--    coarsened to a postal-centroid; NOT user input).
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS latitude numeric,
    ADD COLUMN IF NOT EXISTS longitude numeric;

-- 4. Drop the redundant free-text region column.
ALTER TABLE public.users
    DROP COLUMN IF EXISTS region;

-- 5. Rewrite handle_new_user to persist country_code + postal_code (+ the
--    existing state), and stop referencing the removed region column. Grants
--    are preserved across CREATE OR REPLACE, but the REVOKE from 03_hardening
--    is re-applied defensively.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, username, email, account_type_code, country_code, state, postal_code)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'account_type', 'hobbyist'),
        NEW.raw_user_meta_data->>'country_code',
        NEW.raw_user_meta_data->>'state',
        NEW.raw_user_meta_data->>'postal_code'
    );
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
