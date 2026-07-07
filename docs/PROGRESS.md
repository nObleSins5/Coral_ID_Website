# Progress & Handoff

*Working checkpoint for resuming this project in a fresh session — start here instead of replaying chat history. Written 2026-07-06, last updated 2026-07-06, branch `claude/repo-setup-wmc6wq`.*

Read `README.md` and `docs/reef-platform-spec.md` first for product context; `docs/schema-decisions.md` for why the schema looks the way it does; `docs/future-considerations.md` for product ideas raised but not yet scheduled (e.g. affiliate-link staleness).

## Live infrastructure

- **Supabase project**: `jbfjzkhjbsrnwnmrydba` (org account clay.ks88@gmail.com), region us-west-2, Postgres 17.6.
  - URL: `https://jbfjzkhjbsrnwnmrydba.supabase.co`
  - Anon/publishable key: in `web/.env.local` on the user's machine (gitignored, not in this repo). Get it again via Supabase dashboard → Settings → API if needed.
  - Managed through the **Supabase MCP connector** in Claude sessions — it disconnects/reconnects intermittently; retry `ToolSearch` for `mcp__Supabase__*` tools if they're missing. Direct network calls to `supabase.co` from a cloud/sandboxed Claude session are blocked by the proxy; only the MCP tools reach it. A user's own machine (or Vercel) has normal network access — no such restriction, and is the reliable fallback for applying SQL Editor migrations when the MCP is down.
- **GitHub repo**: `nObleSins5/Coral_ID_Website`, private. Working branch: `claude/repo-setup-wmc6wq`.
- **Vercel**: not yet deployed. When deploying, set Root Directory to `web` and the two env vars above.

## What's built, applied, and user-confirmed live

1. **Schema** — `sql/coral_trait_schema.sql` + `sql/reef-platform-schema.sql`. Applied and validated. See `docs/schema-decisions.md`.
2. **Supabase integration layer** — `sql/supabase/`, all applied to the live project:
   - `01_auth_integration.sql` — binds `public.users` to `auth.users`, auto-provisions the profile on signup.
   - `02_rls_policies.sql` — RLS on every table; public read on wiki/lookup surface, owner-scoped elsewhere. Enforcement-tested.
   - `03_hardening.sql` — clears the security advisor's real WARNs.
   - `04_normalize_taxonomy.sql` — collapses the browse tree to Genus → Morph (species shown as `scientific_name` on the detail page only). Applied; user-verified the corrected tree live.
   - `05_storage.sql` — public `coral-photos` Storage bucket, owner-scoped write RLS. Applied; photo upload confirmed working live.
   - `06_public_usernames.sql` — narrow `get_public_usernames()` SECURITY DEFINER function (id+username only) for photo attribution, without opening the `users` table to public reads. Applied.
   - `07_photo_votes.sql` — `coral_photo_votes` table + RLS (mirrored into `reef-platform-schema.sql` §6 for from-scratch installs). Applied; voting confirmed working live.
3. **Seed data** — `sql/seed/phase0_corals.sql`. 37 corals across 27 genera. Applied. **Hex colors and care values are provisional placeholders**, not final (spec §9 open decision).
4. **Web app** (`web/`, Next.js 16 App Router + `@supabase/ssr`), all confirmed working against the live DB by the user:
   - **Phase 0 vertical slice** — signup → create tank → log parameters.
   - **Coral wiki** — `/wiki` → `/coral/[genus]` → `/coral/[genus]/[morph]`. Genus→Morph browse tree, care guidance, recommended parameters, full element color key (hex swatches per part). Static-generated for SEO.
   - **Photo logging** — upload a photo attached to a taxon (`app/coral/actions.ts` `uploadCoralPhoto`), optionally stamped with a tank's parameter reading that was actually current **as of the photo's `taken_at` date** (not just "latest" — an old photo gets the reading that was real back then, or `null` if none qualifies).
   - **Photo social layer** — each photo card shows the uploader's username and an expandable `<details>` drawer with the real parameter values; a single, clearly-labeled **"✓ Confirm match"** vote (deliberately not a generic like button — see `docs/future-considerations.md` for why); the taxon's hero image is the **most-voted photo**, computed live (no batch job), falling back to newest-photo-with-zero-votes, then to the gradient color placeholder when no photos exist.

## Known, deferred polish (not urgent)

- **Image display sizing** — user confirmed everything works functionally, but photos render "very large" in places (likely the hero image and/or gallery cards need tighter max-height/cropping rules). Explicitly deferred by the user for a later design pass — not a functional bug, just unrefined CSS.

## Immediate next steps (pick one — nothing is currently blocking)

1. **Deploy to Vercel** (Root Directory `web`, same two env vars). Nothing else is blocking this now — the core loop, wiki, and photo/voting features are all live-confirmed.
2. **Design pass** — photo sizing above, plus general visual polish now that there's real content and interaction to look at.
3. **Next feature**, candidates already scoped/discussed:
   - Specimen linkage (attach a photo to a specific tank specimen, not just standalone-to-taxon) — deferred from the photo-logging build.
   - "Unidentified — help me ID this" + the `id_suggestions`/`id_votes` community confirmation queue — deferred from the photo-logging build.
   - Vendor/affiliate links (attach to photos, not taxa) — see `docs/future-considerations.md` for the dead-link problem to design around before building.
4. **Seed data accuracy pass** — the 37 corals' colors/care values are still provisional placeholders.

## Deliberately deferred (not bugs, not forgotten)

- Specimen linkage, unidentified-ID flow, vendor/affiliate links — see above.
- **Messaging, inquiries, local trade discovery** — schema-stubbed, Phase 4 per the spec.
- **`scripts/draw_diagrams.py` / `normalize_reef.py`** — reframed (see README) into a future data-driven identification diagram + multi-lighting reference approach; not built.
- Search page, business/retail flows — later phases per spec §4.

## Open product decisions still unresolved

See `docs/schema-decisions.md` §13 for the full list (naming/branding, pricing tiers, affiliate terms, real color-range provenance, moderation policy, auth provider choice, storage target), plus `docs/future-considerations.md` for the affiliate dead-link problem.
