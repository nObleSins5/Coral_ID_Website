# Progress & Handoff

*Working checkpoint for resuming this project in a fresh session — start here instead of replaying chat history. Written 2026-07-06, last updated 2026-07-08, branch `claude/repo-setup-wmc6wq`.*

Read `README.md` and `docs/reef-platform-spec.md` first for product context; `docs/schema-decisions.md` for why the schema looks the way it does; `docs/future-considerations.md` for product ideas raised but not yet scheduled (e.g. affiliate-link staleness).

## Live infrastructure

- **Supabase project**: `jbfjzkhjbsrnwnmrydba` (org account clay.ks88@gmail.com), region us-west-2, Postgres 17.6.
  - URL: `https://jbfjzkhjbsrnwnmrydba.supabase.co`
  - Anon/publishable key: in `web/.env.local` on the user's machine (gitignored, not in this repo). Get it again via Supabase dashboard → Settings → API if needed.
  - Managed through the **Supabase MCP connector** in Claude sessions — it disconnects/reconnects intermittently; retry `ToolSearch` for `mcp__Supabase__*` tools if they're missing. Direct network calls to `supabase.co` from a cloud/sandboxed Claude session are blocked by the proxy; only the MCP tools reach it. A user's own machine (or Vercel) has normal network access — no such restriction, and is the reliable fallback for applying SQL Editor migrations when the MCP is down.
- **GitHub repo**: `nObleSins5/Coral_ID_Website`, private. Working branch: `claude/repo-setup-wmc6wq`, merged (fast-forward) into `main` 2026-07-06. Vercel deploys from `main`.
- **Vercel**: deployed and confirmed working (Root Directory `web`, the two env vars above set for Production). One gotcha hit and resolved: Vercel's env-var form scopes each variable to Production/Preview/Development independently — the first deploy failed (`supabaseUrl is required` during `generateStaticParams`) because the vars weren't checked for Production; fixed by re-adding with Production checked and redeploying.

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
4. **Tank grid + specimen placement** — code complete, **migration not yet applied to the live DB** (Supabase MCP was unavailable this session; see pending-migration note below). `sql/supabase/10_tank_grid.sql` (mirrored into `reef-platform-schema.sql` §3/§6):
   - `tanks.grid_columns` / `grid_rows` record the chosen layout (NULL = not configured yet).
   - A partial unique index (`uq_specimens_grid_slot`) enforces one specimen per slot; NULL (unplaced) is unrestricted. Moving a specimen is a single `UPDATE` of `specimens.grid_slot_id`, so the old slot is vacated automatically — no occupancy-history table (per `docs/schema-decisions.md` §4).
   - Tank creation (`app/dashboard/actions.ts` `createTank`) optionally takes columns/rows/tiers and bulk-generates `grid_slots` with labels like `C5` / `C5 · L2` (`lib/grid.ts`). Tanks created before this feature (or skipped at creation) get a one-shot **"Set up grid"** form on their tank page (`app/tank/actions.ts` `configureGrid`) — deliberately one-shot, since resizing in place would orphan placed specimens.
   - New `/tank/[id]` page: visual grid (one sub-grid per tier), occupied cells link to the specimen, plus a list of unplaced specimens in that tank each with a slot-picker to place them (`components/place-specimen-control.tsx`).
   - New `/specimen/[id]` page: place/move (slot dropdown) and a **"Remove from tank"** button (`components/remove-from-tank-button.tsx`) that clears `grid_slot_id` without deleting the specimen. Also adds **specimen editing** — nickname, acquired date, and representative photo are now editable after creation (`app/specimen/actions.ts` `updateSpecimen`), reusing `specimens.representative_photo_id` rather than a new column. The photo-picker grid was extracted to `components/photo-picker.tsx`, shared by both the add-specimen and edit-specimen forms.
   - Dashboard tank names now link to `/tank/[id]`.
5. **Affiliate/vendor links** — code complete, **migration not yet applied to the live DB** (same MCP-unavailability blocker as item 4; see pending-migration note below). `sql/supabase/11_affiliate_links.sql` (mirrored into `reef-platform-schema.sql` §10, `02_rls_policies.sql`), executing on the design in `docs/future-considerations.md`'s "Affiliate links: preventing dead links" note:
   - **No separate vendor account tier** — any authenticated user can attach a link to a photo *they uploaded* (`affiliate_links_owner_write` RLS, scoped via `coral_photos.uploader_user_id`), reusing the existing photo-logging feature rather than a new vendor flow (future-considerations idea 6a).
   - **`link_type`** (`wysiwyg` vs `representative`, future-considerations idea 1) — an explicit trust signal shown in the UI ("exact specimen pictured, may already be sold" vs "this morph, typical example").
   - **Community "report dead link" flagging** (idea 3) — `affiliate_link_reports` (one per user per link) + a trigger (`handle_affiliate_link_report`) that auto-deactivates a link once distinct reports cross `app_settings.affiliate_dead_link_report_threshold` (default 3). Automated health checks and TTLs (ideas 4-5) are still not built.
   - Outbound clicks are never linked to directly — `/go/[id]` (`app/go/[id]/route.ts`) logs a hashed-IP click (`affiliate_clicks`, RLS insert-only) then redirects, re-validating the URL scheme before doing so.
   - **`AffiliateLinkManager`** (`components/affiliate-link-manager.tsx`) renders inside each photo card, but only shows anything to that photo's own uploader (add a link / deactivate their own). Everyone else sees the public list on the morph page's **"Where to find it"** section (was a stub card; now real, with a **Report dead link** button per listing).
6. **Web app** (`web/`, Next.js 16 App Router + `@supabase/ssr`), all confirmed working against the live DB by the user:
   - **Phase 0 vertical slice** — signup → create tank → log parameters.
   - **Coral wiki** — `/wiki` → `/coral/[genus]` → `/coral/[genus]/[morph]`. Genus→Morph browse tree, care guidance, recommended parameters, full element color key (hex swatches per part). Static-generated for SEO.
   - **Photo logging** — upload a photo attached to a taxon (`app/coral/actions.ts` `uploadCoralPhoto`), optionally stamped with a tank's parameter reading that was actually current **as of the photo's `taken_at` date** (not just "latest" — an old photo gets the reading that was real back then, or `null` if none qualifies).
   - **Photo social layer** — each photo card shows the uploader's username and an expandable `<details>` drawer with the real parameter values; a single, clearly-labeled **"✓ Confirm match"** vote (deliberately not a generic like button — see `docs/future-considerations.md` for why); the taxon's hero image is the **most-voted photo**, computed live (no batch job), falling back to newest-photo-with-zero-votes, then to the gradient color placeholder when no photos exist.
   - **Unidentified-ID flow** (`/identify`) — Door 1's actual primary entry point. Upload a photo with no taxon, propose an identification (match existing / match-plus-alias-proposal / brand-new-morph), vote, and an asymmetric trigger (`handle_id_vote_change`) resolves it: cheap immediate rejection (`net ≤ -3`) vs. a three-part confirm bar (24h age + 10-vote quorum measured per-suggestion + net ≥ 3) that writes the photo's taxon and can create a whole new `taxon_nodes` row. **User-tested live** with temporarily-lowered thresholds: confirmed the photo correctly disappeared from the unidentified queue, and that a new taxon row really was created — see the pending cleanup note below.

## ⚠️ Pending: apply two migrations (tank grid + affiliate links)

Neither has been applied to the live DB yet — the Supabase MCP connector wasn't available this session (`enabledInChat: false` for this chat specifically, per `ListConnectors` — it's authenticated at the org level, just toggled off here; see Live infrastructure above). Enable it in this chat's connector settings, then either retry `ToolSearch` for `mcp__Supabase__*` tools, or paste the files below into the Supabase SQL Editor from the user's own machine (reliable fallback — no proxy restriction there):
1. `sql/supabase/10_tank_grid.sql` — until applied, `/tank/[id]` and `/specimen/[id]` will error on `grid_columns`/`grid_rows`/`uq_specimens_grid_slot` not existing.
2. `sql/supabase/11_affiliate_links.sql` — until applied, adding/reporting an affiliate link, and the `/go/[id]` click-log redirect, will error on `link_type`/`affiliate_link_reports`/the new RLS policies not existing. Apply *after* #1 isn't required (independent), but both are needed before smoke-testing either feature.

Both are idempotent (`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` / `DROP POLICY IF EXISTS` before `CREATE POLICY`), safe to run more than once.

## ⚠️ Pending cleanup: test taxon in production data

While live-testing the unidentified-ID flow's "propose a new morph" path with temporarily-lowered thresholds, a **real `taxon_nodes` row was created from test data** (the trigger's confirm step genuinely inserts a new coral into the taxonomy — that's the feature working correctly, but it means a fake/test coral is now sitting in the live wiki). Not yet cleaned up — user was on mobile and asked to be reminded.

To find it:
```sql
select s.id as suggestion_id, s.proposed_name, s.resolved_at,
       cp.id as photo_id, cp.url as photo_url,
       tn.id as taxon_id, tn.name as new_coral_name, tn.slug, tn.parent_id as genus_id
from id_suggestions s
join coral_photos cp on cp.id = s.coral_photo_id
join taxon_nodes tn on tn.id = s.proposed_taxon_id
where s.status_code = 'confirmed'
order by s.resolved_at desc limit 5;
```
Cleanup must happen in FK-safe order (several tables reference this taxon with no cascade — the photo, the suggestion, possibly `id_votes` via cascade from the suggestion): delete the `id_suggestions` row first (cascades to its `id_votes`), then the `coral_photos` row (also remove the underlying object from the `coral-photos` storage bucket if you want to fully clean up), then finally the `taxon_nodes` row itself.

## Known, deferred polish (not urgent) — a UI pass backlog

- **Image display sizing** — photos render "very large" in places (hero image and/or gallery cards need tighter max-height/cropping rules).
- **Specimen photo picker (`add-specimen-form.tsx`)** — functionally confirmed (picking your own photo correctly sets `specimen_id`), but the UI needs work: clicking a thumbnail doesn't clearly show it got selected (the `.selected` border is too subtle), thumbnails render at inconsistent sizes (no forced aspect-ratio/object-fit crop like the other photo grids have), and the "Yours" tag styling is rough.

All confirmed functional; explicitly deferred by the user for a later dedicated design pass — not bugs.

## Status: original roadmap complete, plus specimen linkage, the unidentified-ID flow, wishlisting, the tank grid, and affiliate links

Schema → seed data → vertical slice → coral wiki → photo logging & voting → public deployment → specimen linkage → unidentified-ID flow → wishlist button → tank grid + specimen editing → affiliate/vendor links are all built. Everything except the tank grid and affiliate links is live and user-confirmed; those two are code-complete but **need their migrations applied and a live smoke test** (see the pending-migration note above) before they can be marked confirmed. Pick any of the following to keep going — nothing else is blocking:

1. **Enable the Supabase connector for this chat, then apply both pending migrations and smoke-test live** — see the pending-migration note above: (tank grid) create a tank with a grid, place/move/remove a specimen, edit its representative photo; (affiliate links) upload a photo, attach a link to it as `wysiwyg` and as `representative`, visit it through `/go/[id]` and confirm a row lands in `affiliate_clicks`, then report it dead from a second account enough times to confirm it auto-deactivates.
2. **Clean up the test taxon** — see the pending-cleanup note above.
3. **UI polish pass** — the backlog above, now that there's real content/interaction across several features to look at together.
4. **Next feature**, candidates already scoped/discussed:
   - Alias-approval / moderation queue — `coral_aliases` proposals from the ID flow now accumulate with `status='proposed'` and nothing ever reviews them; the spec's sitemap always called for a separate admin/moderator queue for this.
   - Vendor-availability matching against wishlists — the bigger idea `want_list` was originally scoped for (spec §5.4 Door 2); see `docs/future-considerations.md` — needs real design decisions (notification model, what each side sees) before scheduling.
   - Automated affiliate-link health checks / WYSIWYG TTL-expiration — future-considerations.md ideas 4-5, not built; the vendor-uploaded-photo flow and report-flagging (ideas 6a, 3) are.
5. **Seed data accuracy pass** — the 37 corals' colors/care values are still provisional placeholders.

## Deliberately deferred (not bugs, not forgotten)

- Wishlist-to-vendor-availability matching, alias moderation — see above.
- **Messaging, inquiries, local trade discovery** — schema-stubbed, Phase 4 per the spec.
- **`scripts/draw_diagrams.py` / `normalize_reef.py`** — reframed (see README) into a future data-driven identification diagram + multi-lighting reference approach; not built.
- Search page, business/retail flows — later phases per spec §4.

## Open product decisions still unresolved

See `docs/schema-decisions.md` §13 for the full list (naming/branding, pricing tiers, affiliate terms, real color-range provenance, moderation policy, auth provider choice, storage target), plus `docs/future-considerations.md` for the affiliate dead-link problem.
