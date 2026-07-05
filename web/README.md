# Reef Platform — Web app

Next.js (App Router, TypeScript) front end for the Reef Platform, talking to
Supabase. This is the **Phase 0 vertical slice**: sign up → create a tank → log
parameters, end to end against a live Supabase database with Row-Level Security.

## Prerequisites

1. A Supabase project with the schema applied, in this order, via the SQL Editor:
   1. `../sql/coral_trait_schema.sql`
   2. `../sql/reef-platform-schema.sql`
   3. `../sql/supabase/01_auth_integration.sql`
   4. `../sql/supabase/02_rls_policies.sql`
2. For local development, turn **off** email confirmations
   (Supabase → Authentication → Providers → Email) so signup logs you straight
   in. Re-enable before real launch.

## Setup

```bash
cp .env.local.example .env.local     # then fill in your project URL + anon key
npm install
npm run dev                          # http://localhost:3000
```

Get the URL and anon (public) key from Supabase → Settings → API.

## What the slice does

- **`/signup`** — collects username, email, password, account type, region,
  state, zip (spec workflow 5.0). Profile fields are passed as auth metadata;
  the `handle_new_user` DB trigger creates the `public.users` profile row.
- **`/login`** / **`/auth/signout`** — email + password session.
- **`/dashboard`** — create a tank (workflow 5.1) and log a parameter reading
  (the core five: alkalinity, calcium, magnesium, nitrate, phosphate). RLS
  scopes every read/write to the signed-in user.

## Structure

```
app/
  page.tsx              Landing
  signup/, login/       Auth (server actions)
  auth/signout/         Sign-out route
  dashboard/            Create tank + log parameters (server actions)
lib/supabase/
  client.ts             Browser client
  server.ts             Server client (cookie-bound)
  middleware.ts         Session refresh + /dashboard guard
proxy.ts                Next.js proxy (formerly middleware) entry
```

## Deploy

Push to Vercel (free tier) and set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables in the project settings.
