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
- At upload (or as a later edit step), the uploader taps a point/region in the photo and tags what it is: white frag plug / black background / "I have an actual white-balance or gray card in frame."
- **The reference "true" value should be a categorical pick, not a perceptual color-match.** Since plug white isn't perfectly standardized, offer a small set of genuinely distinct known constants ("closest to: bright white / bone / light gray") for the user to choose *which material* they have — a discrete, low-ambiguity choice. Do **not** ask the user to eyeball-match their photo against on-screen swatches: their own viewing display (phone/monitor) is just as uncalibrated as the camera that took the photo, so a perceptual match trades one uncontrolled variable for a second one instead of removing it. Once the category is picked, software auto-samples the actual pixels at the tagged location — no human color judgment involved in that step.
- Compute the difference between the selected known-true value and the sampled observed value at that location — *delta first, then apply* (this is exactly how a "click white balance" eyedropper tool works in photo editors). For a black-background tag this is an offset; for a plug/gray-card tag it's closer to a per-channel scale.
- Doing that delta in raw sRGB (simple per-channel scaling) is an acceptable v1, but can introduce hue shifts on strongly saturated colors. Computing the delta in a perceptually uniform space (CIELAB) instead is more robust and worth it if this needs to be more than "meaningfully better than uncorrected."
- Apply the correction to the coral's own sampled pixels before writing a hex value — keep the raw, uncorrected sample alongside it (audit trail, and lets the correction logic improve later without re-uploading).
- Only meaningfully improves things when a trustworthy reference is actually tagged. If nothing reliable is visible, the honest move is to keep the raw hex flagged as uncorrected rather than guessing with an untrustworthy anchor.

### Known limits, even done well
This is single-point white balance, not full colorimetric calibration — it corrects a per-channel gain/offset, not a full color transform, so it won't handle non-linear sensor response, lens/vignetting falloff, or channel crosstalk. It also can't fix **fluorescence**: much of what makes SPS coloration striking under actinic lighting is fluorescent emission, not reflected light, and fluorescence doesn't behave like a reflective-color correction at all — a "corrected" fluorescent color under a different assumed light spectrum is a different number, not a truer one. Frame this as "meaningfully better than an uncorrected raw hex," not "the coral's true color."

### Not deciding now
Needs real product decisions before scheduling: whether correction happens at upload time or as an editable later step; whether uncorrected hexes get flagged or excluded from the wiki's "typical color range" aggregation; whether reference-tagging is required or optional; and how (or whether) to eventually nudge hobbyists toward a real, cheap, standardized reference (e.g. a small white/gray sticker sold for exactly this purpose) instead of relying on opportunistic in-frame objects. This doesn't resolve the "real color-range provenance" open decision (spec §9 / schema-decisions.md §13) — it gives that decision a concrete mechanism to evaluate against.

---

## Genus-level care defaults, data-derived recommended parameters, and a per-coral comment board (raised 2026-07-11)

Three related ideas, surfaced together while discussing what actually populates a new morph's care/parameter/color fields today. Answering that question turned up a real gap: a community-confirmed new morph (`handle_id_vote_change()`, `sql/reef-platform-schema.sql`) only ever gets `name`, `slug`, and `parent_id` set — care difficulty, light, flow, growth form, description, every `rec_*` parameter range, and the entire element color key are all blank until someone with direct database access fills them in by hand. There's no RLS policy or app UI granting any user, including a moderator, write access to those columns today.

### Idea 1: genus-level defaults for care/light/flow — **Built** (2026-07-11)

Care difficulty, light level, and flow level are observed to be substantially a genus-level property, not a morph-level one — every *Acropora* wants high light/high flow regardless of which specific morph; every *Euphyllia* (hammer/frogspawn/torch) wants moderate difficulty and lower light/flow, again regardless of morph. `growth_form_code` deliberately stays morph-only — growth form genuinely varies within a genus (Acropora alone has both branching and tabling morphs), unlike care/light/flow.

Went with **resolve-at-read** (option (b) below), not copy-at-creation: a morph with a null care/light/flow field falls back to its parent genus's value at render time (`withGenusCareDefaults`, `web/lib/wiki.ts`), rather than the genus's value being copied onto the morph row at creation. A genus-level correction instantly fixes every morph under it, instead of needing a bulk-update across every already-created morph row. All 27 genera got a default (`sql/supabase/16_genus_care_defaults.sql`): the majority value among each genus's own already-seeded morphs where more than one exists, standard reef-keeping consensus where only one morph was seeded, and Acropora/Euphyllia set from direct product guidance where it differed from an individual seeded morph's rating. No existing morph row was touched — this only ever fills in a value a morph left null, which today means every future community-confirmed new morph (`handle_id_vote_change()` only ever sets `name`/`slug`/`genus`, see above).

### Idea 2: real user data (parameters + husbandry + equipment) should refine recommended values over time, not just seed them once

The schema already anticipated this correlation — `docs/schema-decisions.md` §5 says outright that "raw parameters alone don't explain coloration — the *regimen* does," which is exactly why `parameter_readings`, `husbandry_products`/`dosing_methods`/`tank_additives`, and `equipment_events` (light/flow setpoints as a 0–100 percent, per §6) all exist as a *temporal* layer correlated to when a photo was taken. What was never spelled out is the actual **process** that turns those logged data points into the wiki's displayed "recommended parameters" and "typical element colors" — today that number is just whatever was hand-seeded once, with no path back from real logged tank data to a refined value.

Proposed process, matching what was asked for:
1. **Seed a placeholder immediately, from genus knowledge, at creation time.** When a new genus (or ideally, a new morph whose genus already has established defaults) is added, pre-fill recommended parameters and care/light/flow from known reef-keeping consensus for that genus — better than a wiki entry with nothing at all, and honestly labeled as a starting estimate rather than a confirmed range.
2. **Let real logged data pull that placeholder toward the truth over time.** For every `coral_photos` row confirmed against a taxon, its parameter snapshot (already computed at upload — `computeParameterSnapshot`, `lib/photo-upload.ts`) plus whatever husbandry/equipment context was active for that tank at that time is a single real data point linking "these conditions" to "this observed coloration/growth." Once enough of these accumulate for a given morph (or its genus, before any one morph has enough), an aggregate (e.g. a median/percentile band, not a single average that a single outlier tank could skew) becomes a genuinely community-derived range instead of a guess.
3. **This is "fine-tuning," not full automation, at least at first.** Given the current scale (4 users, 6 photos, 3 votes total as of 2026-07-11), there's nowhere near enough data yet to derive anything statistically meaningful — this needs to be designed now but activated later, once there's a real base of confirmed photo+parameter+husbandry data to draw from.

### Idea 3: a per-coral comment/discussion board, strongly moderated

Separate from voting on an identification or approving an alias, a simple comment thread on each morph page (and maybe genus page) for open-ended discussion — care tips, "mine did this when I raised flow," questions — the kind of thing that currently has no home anywhere in the product. Explicitly called out as needing "a strong moderation cue," which lines up with the `is_moderator` role and the `/moderate` queue just built for `coral_aliases`/`husbandry_products` — a comments table would want the same shape (a `moderation_status_code` or at minimum a report/hide mechanism, moderator-reviewable) rather than being open-post with no backstop.

### Not deciding now

Genus defaults are built (above); the other two still need real design decisions before scheduling:
- **Derived parameters**: the actual statistic (median? percentile band? minimum sample size before showing a derived range instead of the seeded placeholder?), whether derived values ever *replace* the seeded placeholder automatically or always require a moderator to accept the update (given `coral_aliases`/`husbandry_products` both chose "moderator approves" over "auto-publish," derived parameters probably should too), and how to weight/exclude an outlier tank (sick coral, miscalibrated test kit) from skewing the aggregate.
- **Comment board**: flat vs. threaded, who can post (any authenticated user? or does it need the same account-standing consideration as aliases), and whether moderation is pre-publish (queue-gated, like aliases) or post-publish (live immediately, moderator can remove) — pre-publish fits "strong moderation" better but adds friction to what's meant to be a low-friction engagement feature.
- None of this resolves the still-open "real color-range provenance" decision (spec §9 / schema-decisions.md §13) — it gives that decision a concrete, phased process to evaluate against, the same way the color-cast-correction idea above does for the sampling side of the same problem.
