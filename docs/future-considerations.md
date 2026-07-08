# Future Considerations

*A running scratchpad for product/design problems worth solving later — surfaced during a build, written down before they're lost, not yet scheduled into a phase. See `docs/reef-platform-spec.md` §9 for the more formal "Open Decisions" list; this file is earlier-stage than that.*

---

## Affiliate links: preventing dead links (raised 2026-07-06)

Affiliate links attach to a `coral_photos` row, not a taxon (see `docs/schema-decisions.md` §10) — a vendor showcases *their* photo of a coral to compete with other vendors selling the "same" morph. That design creates a real staleness problem worth solving before the feature ships, not after.

### The core distinction

A vendor's link is one of two fundamentally different things, and they decay at different rates:

- **WYSIWYG / specific-listing link** — points at *the exact individual frag pictured*. High trust (buyer gets precisely what they saw), but **the link goes dead the moment that specimen sells.** Short shelf life.
- **Representative / general-listing link** — points at the vendor's page for *that morph in general* (a product/category page, not one specific frag). Longer shelf life, but weaker trust: the pictured coloration may not match what a buyer actually receives, and the page can still go stale (out of stock, discontinued, price changed) without ever technically "dying."

Right now the schema doesn't distinguish these two cases at all — `affiliate_links` is just `vendor_name`, `url`, `referral_code`, `is_active`. That's fine for today (feature isn't built yet), but the link-type distinction should probably become an explicit field before this ships, since the platform's credibility depends on links actually working.

### Ideas for keeping links alive / honest (unordered, unevaluated)

1. **Tag the link type explicitly** (`wysiwyg` vs `representative`) so the UI can set the right expectation ("this exact specimen" vs "this morph, typical example") and apply different staleness rules to each.
2. **Vendor self-service marking** — the fastest, most accurate signal, but requires the vendor to have an account and actually bother to update it. Probably necessary regardless of what else is built, since nothing else catches "sold 10 minutes ago" reliably.
3. **Community "report dead link" flagging** — cheap, crowdsourced, fits the platform's existing moderation pattern (parallel to ID suggestions/aliases). Doesn't require vendor cooperation, but is reactive (link is already dead by the time it's flagged).
4. **Automated link health checks** — periodically request each URL and look for obvious failure signals (404, redirect to homepage). Weak on its own: most storefronts return 200 with a "sold out" banner rather than an actual error, so this alone won't catch WYSIWYG staleness. Could still catch outright broken/removed pages cheaply.
5. **TTL / expiration on WYSIWYG links specifically** — auto-expire (or auto-hide) a specific-listing link after N days unless the vendor actively renews it. Forces staleness to resolve itself rather than accumulate silently. Representative links wouldn't need this, or would use a much longer TTL.
6. **Make link submission fast enough that vendors actually maintain it.** The whole idea dies if updating a link is annoying. Directions worth exploring:
   - A vendor uploads *their own listing photo* directly as a `coral_photos` row with the link attached — this reuses the photo-logging feature being built now rather than inventing a separate vendor flow.
   - A minimal vendor-side quick-add (paste URL + pick/confirm the coral) rather than a full dashboard.
   - Possibly auto-suggest which taxon a vendor's photo matches using the same element/color data the wiki already renders, cutting a step out of submission.

### Not deciding now
This needs a real design pass (schema fields, moderation workload, whether vendors need their own account tier beyond what `businesses` already models) once affiliate links are actually being scheduled — currently still a Phase 2 item with the program specifics themselves an open decision (spec §9). Recording it here so the dead-link problem gets designed in from the start rather than retrofitted.

---

## Wishlist → vendor-availability matching (raised 2026-07-06)

Two related but separably-sized ideas, surfaced while scoping specimen linkage.

### The cheap part: a wishlist button (mostly already built)
`want_list` (user_id, taxon_node_id, note) and its owner-scoped RLS have existed since the original schema build (spec §5.4, Door 2 foundation) but have **zero UI** — nothing on the morph page lets a user actually wishlist a coral yet. Adding a simple "☆ Wishlist this" button is close to a pure UI feature, the same shape as specimen linkage turned out to be (schema already there, just needs a button + a query). Low effort whenever it's wanted.

### The bigger part: connecting wishlists to vendor availability
The idea: a **vendor-only view listing every coral in the wiki with a simple checkbox** — "do you currently have this in stock?" — and using that to connect vendors to the hobbyists who have that coral on their want list. Lighter-weight than the retail machinery already stubbed for later (grid/QR/inquiries): this isn't per-listing inventory, just a coarse per-vendor-per-coral availability flag.

Rough shape, not decided:
- A new table, something like `business_coral_availability (business_id, taxon_node_id, is_available, updated_at)` — one row per vendor per coral they stock, toggled by a checkbox in a vendor dashboard view.
- **The matching/notification question is the real design work**: when a vendor flags a coral available, do want-listers get notified (the existing `notifications` table could carry this)? Does the vendor see *how many* people want it (an aggregate demand count — safe, no personal data exposed) or nothing at all until someone acts? Does the hobbyist see *which* vendors have it, or does the vendor reach out first?
- This is squarely a business/retail-tier feature (needs the `businesses` account type, not just any user), so it's naturally Phase 4+ alongside the other retail features already stubbed — recording the idea now so it's designed in when that phase gets picked up, rather than bolted on.

### Not deciding now
The wishlist button is cheap and could be picked up any time. The vendor-matching half needs real product decisions (notification model, what vendors/hobbyists each see about each other, whether this lives inside `businesses` or needs its own lighter vendor concept) before writing schema for it.
