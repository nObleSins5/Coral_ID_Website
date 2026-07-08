# Future Considerations

*A running scratchpad for product/design problems worth solving later — surfaced during a build, written down before they're lost, not yet scheduled into a phase. See `docs/reef-platform-spec.md` §9 for the more formal "Open Decisions" list; this file is earlier-stage than that.*

---

## Affiliate links: preventing dead links (raised 2026-07-06, built 2026-07-08)

Affiliate links attach to a `coral_photos` row, not a taxon (see `docs/schema-decisions.md` §10) — a vendor showcases *their* photo of a coral to compete with other vendors selling the "same" morph. That design creates a real staleness problem worth solving before the feature ships, not after.

### The core distinction

A vendor's link is one of two fundamentally different things, and they decay at different rates:

- **WYSIWYG / specific-listing link** — points at *the exact individual frag pictured*. High trust (buyer gets precisely what they saw), but **the link goes dead the moment that specimen sells.** Short shelf life.
- **Representative / general-listing link** — points at the vendor's page for *that morph in general* (a product/category page, not one specific frag). Longer shelf life, but weaker trust: the pictured coloration may not match what a buyer actually receives, and the page can still go stale (out of stock, discontinued, price changed) without ever technically "dying."

Right now the schema doesn't distinguish these two cases at all — `affiliate_links` is just `vendor_name`, `url`, `referral_code`, `is_active`. That's fine for today (feature isn't built yet), but the link-type distinction should probably become an explicit field before this ships, since the platform's credibility depends on links actually working.

### Ideas for keeping links alive / honest (unordered, unevaluated)

1. ~~**Tag the link type explicitly** (`wysiwyg` vs `representative`)~~ **Built** — `affiliate_links.link_type`, surfaced in the UI as "this exact specimen" vs "this morph, typical example" (`sql/supabase/11_affiliate_links.sql`).
2. **Vendor self-service marking** — still not built beyond deactivating a link entirely (`deactivateAffiliateLink`); there's no "mark as sold" distinct from "remove the link."
3. ~~**Community "report dead link" flagging**~~ **Built** — `affiliate_link_reports` + `handle_affiliate_link_report()` auto-deactivates a link once distinct reports cross a threshold (`app_settings.affiliate_dead_link_report_threshold`, default 3). Still reactive by nature, as noted below.
4. **Automated link health checks** — not built. Weak on its own (most storefronts 200 with a "sold out" banner), but could still catch outright broken/removed pages cheaply.
5. **TTL / expiration on WYSIWYG links specifically** — not built. Representative links wouldn't need this, or would use a much longer TTL.
6. **Make link submission fast enough that vendors actually maintain it.**
   - ~~A vendor uploads *their own listing photo* directly as a `coral_photos` row with the link attached~~ **Built** — any authenticated user can attach a link to a photo they uploaded (`affiliate_links_owner_write` RLS scoped via `coral_photos.uploader_user_id`); no separate vendor account tier required for v1.
   - A minimal vendor-side quick-add (paste URL + pick/confirm the coral) rather than a full dashboard — not built; today it's per-photo, from the morph page.
   - Auto-suggesting which taxon a vendor's photo matches — not built.

### Not deciding now
Ideas 1, 3, and 6a are built (2026-07-08; see `docs/PROGRESS.md`). Vendor account tiers beyond "you uploaded this photo," automated health checks, and WYSIWYG TTLs are still open — pick up if/when affiliate links get real usage and the dead-link problem needs more than reactive reporting.

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

---

## Photo color-cast correction via an in-frame reference (raised 2026-07-08)

Raw hex values sampled from a coral photo are only as good as the photo's white balance. Reef lighting (actinic/blue-shifted LEDs) casts every photo differently depending on fixture spectrum, camera white-balance setting, and sensor — so an uncorrected pixel sample isn't really "the coral's color," it's "the coral's color as distorted by whatever light and camera happened to be used." This is the substance behind the still-open **"real color-range provenance"** decision (spec §9; `docs/schema-decisions.md` §13) — the seeded hex values are still labeled provisional precisely because of this gap.

### The idea
Ask the uploader to tag one point in the photo as a known reference object, then compute a simple correction (a per-channel scale from expected-vs-observed at that point) and apply it to the coral's own sampled pixels before storing a hex value. This is the hobbyist-accessible substitute for a proper color-checker card, which nobody is going to actually buy and carry to the tank.

### Not every candidate reference is trustworthy
Candidates raised: a pure black background, sand, purple coralline algae, a white frag plug.
- **White frag plug — best candidate.** Ubiquitous in specimen photos and the closest thing to a materially-consistent "known" color across the hobby, though not perfectly standardized (manufacturer variation, coralline overgrowth reducing the visible white area as the specimen ages).
- **Black background — partial help only.** Useful for exposure/black-point correction, but weak for correcting the *hue* cast itself, since a black reference carries no gain information — it can't reveal how much the mid-tones and highlights have shifted.
- **Sand and purple coralline — reject as calibration anchors.** Their real-world color isn't actually fixed or known: sand ranges white-to-tan by brand/substrate/staining, and coralline ranges pink-to-purple-to-red by species and is itself lighting-sensitive. Calibrating against an unknown reference launders error into the "corrected" value instead of removing it — worse than doing nothing, since it produces a confidently wrong number rather than an honestly uncorrected one.

### Mechanism sketch (not implemented)
- At upload (or as a later edit step), the uploader taps a point in the photo and tags what it is: white frag plug / black background / "I have an actual white-balance or gray card in frame."
- Compute a per-channel scale (and, for a black-background tag, an offset) from the expected vs. observed value at that point.
- Apply the correction to the coral's own sampled pixels before writing a hex value — keep the raw, uncorrected sample alongside it (audit trail, and lets the correction logic improve later without re-uploading).
- Only meaningfully improves things when a trustworthy reference is actually tagged. If nothing reliable is visible, the honest move is to keep the raw hex flagged as uncorrected rather than guessing with an untrustworthy anchor.

### Known limits, even done well
This is single-point white balance, not full colorimetric calibration — it corrects a per-channel gain/offset, not a full color transform, so it won't handle non-linear sensor response, lens/vignetting falloff, or channel crosstalk. It also can't fix **fluorescence**: much of what makes SPS coloration striking under actinic lighting is fluorescent emission, not reflected light, and fluorescence doesn't behave like a reflective-color correction at all — a "corrected" fluorescent color under a different assumed light spectrum is a different number, not a truer one. Frame this as "meaningfully better than an uncorrected raw hex," not "the coral's true color."

### Not deciding now
Needs real product decisions before scheduling: whether correction happens at upload time or as an editable later step; whether uncorrected hexes get flagged or excluded from the wiki's "typical color range" aggregation; whether reference-tagging is required or optional; and how (or whether) to eventually nudge hobbyists toward a real, cheap, standardized reference (e.g. a small white/gray sticker sold for exactly this purpose) instead of relying on opportunistic in-frame objects. This doesn't resolve the "real color-range provenance" open decision (spec §9 / schema-decisions.md §13) — it gives that decision a concrete mechanism to evaluate against.
