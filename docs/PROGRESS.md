# Progress & Handoff

*Working checkpoint for resuming this project in a fresh session — start here instead of replaying chat history. Written 2026-07-06, branch `claude/repo-setup-wmc6wq`.*

Read `README.md` and `docs/reef-platform-spec.md` first for product context; `docs/schema-decisions.md` for why the schema looks the way it does. This file is just "what's done, what's next."

## Live infrastructure

- **Supabase project**: `jbfjzkhjbsrnwnmrydba` (org account clay.ks88@gmail.com), region us-west-2, Postgres 17.6.
  - URL: `https://jbfjzkhjbsrnwnmrydba.supabase.co`
  - Anon/publishable key: in `web/.env.local` on the user's machine (gitignored, not in this repo). Get it again via Supabase dashboard → Settings → API if needed.
  - Managed through the **Supabase MCP connector** in Claude sessions — it disconnects/reconnects intermittently; retry `ToolSearch` for `mcp__Supabase__*` tools if they're missing. Direct network calls to `supabase.co` from a cloud/sandboxed Claude session are blocked by the proxy; only the MCP tools reach it. A user's own machine (or Vercel) has normal network access — no such restriction.
- **GitHub repo**: `nObleSins5/Coral_ID_Website`, private. Working branch: `claude/repo-setup-wmc6wq`.
- **Vercel**: not yet deployed. When deploying, set Root Directory to `web` and the two env vars above.

## What's built and verified

1. **Schema** — `sql/coral_trait_schema.sql` (taxonomy + traits) and `sql/reef-platform-schema.sql` (everything else), applied in that order. Both validated against a live Postgres instance and against the live Supabase project. See `docs/schema-decisions.md` for every design decision.
2. **Supabase integration layer** — `sql/supabase/`:
   - `01_auth_integration.sql` — binds `public.users` to `auth.users`, auto-provisions the profile row on signup via trigger.
   - `02_rls_policies.sql` — RLS enabled on every table; public read on the wiki/lookup surface, owner-scoped on everything else. Enforcement-tested (cross-user isolation confirmed).
   - `03_hardening.sql` — clears the two real WARNs from Supabase's security advisor (function search_path, exposed SECURITY DEFINER RPC). Applied to live project.
   - `04_normalize_taxonomy.sql` — **written, NOT yet applied to the live project.** Re-parents the two demo corals (Pink Stardust, Rainbow Acan) from a species node up to sit directly under their genus, so the browse tree is uniformly Genus → Morph (product decision — species shown as `scientific_name` on the detail page only, not a browse level). **This is the next concrete action** — apply it via the Supabase MCP (`apply_migration`) or paste it into the Supabase SQL Editor.
3. **Seed data** — `sql/seed/phase0_corals.sql`. ~36 curated, provisional corals (37 total incl. the 2 demo ones) across 27 genera, softies/LPS/SPS. Applied to the live project (confirmed: 37 morphs, 27 genera, 73 color stops). **Hex colors and care values are provisional placeholders** — real content, not final, pending a domain-accuracy pass (spec §9 open decision).
4. **Web app** (`web/`, Next.js 16 App Router + `@supabase/ssr`):
   - Phase 0 vertical slice: signup (→ `handle_new_user` trigger) → create tank → log parameters. **User-tested end-to-end against the live DB — confirmed working.**
   - **Coral wiki** (just built, commit `2992615`): `/wiki` (genus grid) → `/coral/[genus]` (morph list: color-tile placeholder, compact swatch strip, care pills) → `/coral/[genus]/[morph]` (full detail: care guidance, recommended parameter table, full element color key, plus honest stubbed empty-states for "Community photos" and "Where to find it" — those need the next feature to populate). Static-generated for SEO.
   - Typecheck + build verified clean. **Live-data rendering not yet verified from a session with real network access** — the sandbox that built this can't reach Supabase directly; next person to touch this should run `npm run dev` (locally, or wherever Supabase is reachable) and load `/wiki` for real before treating it as fully proven, then re-apply migration 04 first so Pink Stardust/Rainbow Acan show up correctly.

## Immediate next steps (in order)

1. **Apply `sql/supabase/04_normalize_taxonomy.sql`** to the live project (Supabase MCP once connected, or SQL Editor manually — it's idempotent).
2. **Verify the wiki live**: `cd web && npm run dev` → `/wiki` → click into Acropora → click into a morph. Confirm it matches the design already approved via fixture screenshots (sent to the user in-chat).
3. Get the user's sign-off that the live-rendered wiki matches expectations.
4. Deploy to Vercel (Root Directory `web`, same two env vars).

## Deliberately deferred (not bugs, not forgotten)

- **Photo logging** — the natural next feature. Needs: Supabase Storage bucket + RLS, an upload UI, attaching to a specimen/taxon, stamping the immutable parameter snapshot (schema already supports all of this — see `coral_photos` in `reef-platform-schema.sql`). This is what will populate the wiki's "Community photos" stub.
- **Vendor/affiliate links** — attach to photos (not taxa), per product decision. Needs vendor onboarding first.
- **Messaging, inquiries, local trade discovery** — schema-stubbed, Phase 4 per the spec.
- **`scripts/draw_diagrams.py` / `normalize_reef.py`** — reframed (see README) into a future data-driven identification diagram + multi-lighting reference approach; not built.
- Search page, nested species-level browsing (explicitly rejected in favor of Genus→Morph), business/retail flows — all later phases per spec §4.

## Open product decisions still unresolved

See `docs/schema-decisions.md` §13 for the full list (naming/branding, pricing tiers, affiliate terms, real color-range provenance, moderation policy, auth provider choice, storage target).
