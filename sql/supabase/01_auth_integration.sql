-- =============================================================================
-- Supabase layer — Auth integration (01_auth_integration.sql)
-- =============================================================================
-- Apply AFTER coral_trait_schema.sql and reef-platform-schema.sql, in a Supabase
-- project. This is the only place the schema binds to Supabase; the two core
-- files stay provider-agnostic (decision #10).
--
-- Mapping decision (spec workflow 5.0):
--   * Supabase's built-in `auth.users` owns the login mechanics (email, password,
--     sessions, OAuth). We do NOT duplicate credentials.
--   * Our `public.users` is the PROFILE, keyed by the SAME id as `auth.users`.
--     Everything non-credential — username, account type, region, state, zip,
--     external profiles — hangs off `public.users`.
--   * A trigger provisions the profile row automatically on signup, pulling the
--     signup fields from the auth user's metadata.
-- =============================================================================

-- 1. Tie each profile row's id to the auth user id. public.users.id keeps its
--    gen_random_uuid() default for non-Supabase use, but under Supabase the
--    trigger below always sets it to the auth id, and this FK enforces the link.
ALTER TABLE public.users
    ADD CONSTRAINT users_id_auth_fkey
    FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- 2. Auto-create the profile row on signup. Signup should pass username /
--    account_type / region / state / zip in the auth metadata (options.data on
--    the client's signUp call); email comes from the auth user directly.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, username, email, account_type_code, region, state, zip)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'account_type', 'hobbyist'),
        NEW.raw_user_meta_data->>'region',
        NEW.raw_user_meta_data->>'state',
        NEW.raw_user_meta_data->>'zip'
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Note: account_type must be a valid account_types.code ('hobbyist' | 'business').
-- If a signup omits username it defaults to the email local-part; the app should
-- still collect a real username at signup to satisfy the UNIQUE constraint
-- gracefully rather than relying on this fallback.
