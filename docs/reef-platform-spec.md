# Reef Platform — Product & Build Specification

*Amended edition — incorporates review comments dated 2026-07-04. Working title; rename freely. Written so it can be handed to a designer or developer with no prior context.*

*Changes from the previous draft are folded directly into the text below; a full change log appears in Appendix A.*

## 1. Purpose

A community-driven platform where reef aquarium hobbyists log their tank’s water parameters, equipment, and coral inventory — and in doing so, build a crowdsourced record linking coral coloration to the conditions that produced it. Every photo a user uploads to identify or track a coral doubles as a data point: this coral, under these exact conditions, looked like this.

The core principle, and the thing that makes this different from every competitor researched so far:

*This platform is an identification and trust layer that sits next to a purchase or trade — never inside it. It never processes payment, never ships livestock, and never asserts that two differently-named corals are genetically identical. It shows people what they’re looking at and what it takes to keep it alive; the actual transaction always happens elsewhere (in person, at a register, between two hobbyists).*

Explicit non-goals (things this platform deliberately does not do, so scope doesn’t creep):

- Not a marketplace — no in-platform checkout, no payment processing, no handling of funds. Affiliate / referral commissions may be earned when a user clicks through to a coral farmer’s or vendor’s external website, but the platform itself never touches a transaction.

- Not a shipping / logistics company.

- Not a full retail POS system — it complements a shop’s existing register, never replaces it.

- Not a genetic-identity authority — it tracks documented chain of custody (“provenance”) and a structured naming hierarchy, never claims two corals are the same animal.

**Revenue model (summary).** Consumer logging tools are free, always. Revenue comes from (a) the business / retail subscription tier and (b) affiliate / referral commissions on outbound clicks to vendor and coral-farmer websites. No revenue path requires the platform to process a payment, hold funds, or ship livestock.

## 2. Who This Is For — Three Doors, One Database

Everything below is powered by the same underlying data (tanks, specimens, photos), but three different kinds of people arrive at it for three different reasons. Design each entry point for its specific visitor.

Door 1 is the most important one to get right first — it’s the platform’s organic search/SEO engine, and it’s the one no existing competitor (static wikis, forums, or marketplaces like Reefables) fully owns.

| **Door**                  | **Who**                                   | **What they want**                                                                                          | **Why they showed up**                                   |
|---------------------------|-------------------------------------------|-------------------------------------------------------------------------------------------------------------|----------------------------------------------------------|
| 1\. Identification        | Someone who already owns a coral          | Confirm what it is, see what conditions make it thrive, and self-identify by comparing element color ranges | Searched “what is this coral” or was linked from a forum |
| 2\. Collection management | An existing user with a growing tank      | Track their collection, find nearby trades, discover trending corals                                        | Already using the platform, going deeper                 |
| 3\. In-store discovery    | A shop customer, often a nervous beginner | Understand what they’re looking at and whether they can keep it alive                                       | Scanned a QR code on a physical tank                     |

## 3. Guiding Principles (Non-Negotiables)

These are the rules that should override any single feature decision during design or development:

- Sub-30-second logging, or it won’t get used. Every “quick log” action should be one screen, minimal typing, previous value shown as a starting point.

- Timestamped parameters, always available. Water parameters are logged with a timestamp so that when a user posts a photo, the most recent parameter snapshot is already attached — no re-entry. The elapsed time between a photo and its underlying parameter reading is itself surfaced as a trust signal (fresher parameters = higher confidence in the pairing).

- Photo-first, form-second. The photo is the valuable data unit — capture should be the primary action, not buried behind a form.

- **Photos are public by default; provenance is private by default.** A photo (and the parameter snapshot stamped on it) is the platform’s core data capture, so it is public the moment it is uploaded — there is no per-photo opt-in. In contrast, lineage / sourcing information is a protected layer and stays private unless the owner deliberately publishes it. Trade visibility (Door 2) also remains opt-in.

- Provenance, not identity — but identity does not depend on provenance. The lineage system documents “this frag came from that frag” and never claims two named corals are scientifically the same organism. Identification, however, must stand on its own via a structured naming hierarchy (below), because a frag-to-frag chain cannot identify a coral that is being logged for the first time.

- QR codes point to a physical slot, not a specific coral. A shop never has to reprint a code — it always shows whatever currently lives in that spot.

- Free for hobbyists, paid for businesses. Consumer logging tools are free, always. Revenue comes from the business/retail tier plus outbound affiliate commissions.

- No feature ships that requires payment handling, holding funds, or acting as a marketplace. If an idea needs any of those, it’s out of scope. (Outbound affiliate links are allowed; in-platform checkout is not.)

## 4. Phased Roadmap (Condensed)

Build in this order. Each phase should deliver real value even if no later phase ever gets built.

| **Phase**              | **Goal**                                                                         | **Ships**                                                                                                                                                                                                                                       | **Deliberately deferred**                       |
|------------------------|----------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------|
| 0 — Foundation         | Seed content so nothing is ever a blank page, and stand up the core logging loop | Curated, hierarchically-named wiki pages for ~30–40 common, easy-ID corals (with typical element color ranges); tank creation; fast parameter logging; grid placement; specimen + photo logging; zip captured at signup for future geo-matching | User-submitted species, AI ID                   |
| 1 — MVP                | Useful to one person with zero other users                                       | Full tank/collection management on top of the Foundation loop; equipment logging; trend graphs                                                                                                                                                  | Freeform rockscape placement, lineage, aliasing |
| 2 — Light community    | Turns Phase 1 usage into shared data                                             | Public photo pages (photos are public by default — no opt-in), ID confirm/vote, basic lineage, alias tagging, outbound affiliate/vendor links                                                                                                   | Trust-weighted voting, AI-assisted ID           |
| 3 — The differentiator | The actual insight engine                                                        | Aggregate coloration-vs-parameter views, element-level color-range profiles, AI ID trained on confirmed photos                                                                                                                                  | —                                               |
| 4 — Trust & retail     | Harder, higher-trust features                                                    | Lineage visualization, local-shop pilot (grid + QR + inquiries), local trade discovery (turned on over the zip foundation built in Phase 0)                                                                                                     | National marketplace, price index               |
| 5 — Expansion          | Only once data is genuinely valuable                                             | Research / manufacturer partnerships                                                                                                                                                                                                            | —                                               |

**Note:** “Shipping” has been removed entirely from the roadmap — it is not even a deferred item. Specimen + photo logging moved forward into Phase 0. Local trade’s foundation (zip-code capture + an opt-in flag) is built in Phase 0/1 but the discovery experience is not surfaced until Phase 4.

## 5. Core Workflows

Each of these can be turned directly into a wireframe or flow diagram. They’re written as the exact steps a user takes.

### 5.0 New user creates an account

*(New section.)* Account creation is the first thing a user does and is where identity and future geo-matching are established.

1.  Choose a username and password; provide an email address.

2.  Select account type (hobbyist / business).

3.  Optionally link an external community profile (e.g. a Reef2Reef profile URL) to establish reputation and cross-platform trust.

4.  Provide region and state.

5.  Provide a zip code — stored now so local-trade geo-matching (Door 2) can be switched on later without asking users to re-enter it.

6.  (Any additional fields that strengthen user identification can be added here.)

### 5.1 New hobbyist sets up a tank

7.  Sign up / already signed in, with account type selected (hobbyist / business).

8.  Create a tank: name, type, volume, established date.

9.  Enter the tank’s physical dimensions (length × width × height) and choose how many grid slots to lay out. The grid supports X, Y and **Z (height)** placement so a coral’s vertical position on the rockscape can be captured, not just its footprint.

10. Land on an empty tank dashboard with a clear first action: “Log your first parameters” or “Add a coral.”

### 5.2 “What is this coral?” (Door 1)

11. User uploads a photo, either standalone or attached to a specimen in their tank.

12. Search / browse the wiki by the naming hierarchy (Coral → genus → species → hobbyist morph), or self-identify by comparing the coral’s **element profiles** — corallite color, polyp color and size, skin color and profile, and skeletal / growth shape — against the typical color ranges shown on each wiki entry, or select “Unidentified — help me ID this.”

13. If confirmed already, the photo attaches to that wiki entry automatically.

14. If unidentified, it enters the community ID-suggestion queue (5.3).

15. Photo is automatically stamped with the tank’s most recent timestamped parameter snapshot — no re-entry required. The freshness of that snapshot is shown as a trust indicator.

### 5.3 Community ID confirmation

16. A logged-in user browses a queue of pending ID suggestions.

17. Upvote / downvote agreement with a suggested name, or propose an alternate (at any level of the naming hierarchy).

18. Once net votes cross a threshold, status flips to “confirmed” and the photo becomes part of that wiki entry’s public gallery. (The former “if the uploader opted in” condition is removed — photos are public by default.)

### 5.4 Local trade discovery (Door 2)

**Foundation built early, surfaced later.** Zip code is captured at signup (5.0) and an opt-in flag exists from the start, so this feature can be switched on without a data migration. The discovery experience below is a Phase 4 deliverable.

19. User opts in to “visible to nearby traders” (zip code is already on file).

20. User adds corals to a want list.

21. Platform surfaces matches: someone nearby has X on their want list, or owns Y you’re looking for.

22. Users message each other outside the transaction system to arrange a meetup — platform never touches payment.

### 5.5 Shop staff adds inventory (Door 3)

23. Staff logs into their business account, selects the relevant tank / grid.

24. Drops a photo into a grid slot, tags it to a wiki entry (or unidentified).

25. A QR code already exists for that slot (generated once, reused forever).

26. Optionally adds a display note (e.g. a price shown as plain text — not a real transaction field).

### 5.6 Customer scans a QR code in-store (Door 3)

27. No login required.

28. Sees: coral name, care difficulty, a link to the full wiki page with community photos, and the shop’s display note.

29. Taps “I’m interested” → creates an inquiry, notifies staff.

30. Staff completes the actual sale at the register the normal way, then marks the inquiry fulfilled — this triggers the lineage link if the buyer has an account.

### 5.7 Lineage capture

31. Happens automatically whenever a specimen is logged with a known source (a previous specimen, a business, or another user).

32. Defaults to private and is treated as a protected layer — the owner can choose to make it public later. Expect gaps: coral farmers and vendors often will not disclose their sourcing, so chain-of-custody completeness is a known limitation, and identification must never depend on it.

## 6. Pages to Build (Sitemap)

### Public / Marketing

- Landing page — explains the platform, links into the wiki.

- Coral wiki species pages (the SEO engine — one per confirmed name), each showing the typical element color ranges (corallite, polyp, skin, skeletal/growth form) for self-identification.

- Hierarchical browse pages: Coral (L1) → genus (L2) → species (L3) → hobbyist morph (L4).

- Search page (by name, genus, color, care difficulty).

### Auth & Account Setup

- Sign up / log in.

- Account type selection at signup (hobbyist / business).

- **Account setup / profile:** username, password, email, optional Reef2Reef (or other community) profile link, region, state, and zip code (for future geo-matching).

### Hobbyist Dashboard

- My Tanks (list, create, edit) — including tank dimensions and grid-slot configuration.

- Tank detail: quick parameter entry, trend graphs, equipment log, grid view with X/Y/Z placement.

- Add Specimen flow (photo, ID search or “unidentified,” element self-ID, source/lineage entry, place in grid).

- Specimen detail page (photo history, parameter snapshots over time, lineage).

- My Collection / Want List.

- Nearby Traders (Door 2 discovery — Phase 4).

- Notifications.

### Community / Wiki Interaction

- Suggest an ID (attach a photo to an existing or new name, at any hierarchy level).

- Vote / confirm ID queue.

- Propose an alias for an existing entry.

### Business Dashboard

- Business profile & subscription settings.

- Manage locations / tanks (same grid UI as hobbyists, flagged as business).

- Add / update specimens for sale.

- QR code generator & print sheet.

- Inquiries inbox (mark fulfilled / cancelled).

### Customer-Facing (QR scan destination)

- Specimen / slot public page — name, care difficulty, community photo gallery link, “I’m interested” button. No login required.

### Admin / Moderation

- ID and alias moderation queue.

- Business account management.

## 7. Database Schema — Plain-English Map

Full technical schema lives in two companion SQL files:

- coral_trait_schema.sql — the detailed species/morph wiki (genus, growth form, corallite shape, color, fluorescence).

- reef-platform-schema.sql — everything else (this document’s companion file).

Here’s what each table is for, without the SQL:

| **Table**                             | **Plain-English purpose**                                                                                                                                                                                        |
|---------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| users                                 | Every person with an account — hobbyist or business, same table. Now also stores username, email, optional external-profile link (e.g. Reef2Reef), region, state, and zip code.                                  |
| tanks                                 | A tank belongs to a user; a retail display case is just a tank owned by a business. Now also stores physical dimensions (L×W×H) and grid configuration.                                                          |
| parameter_logs                        | Water test results over time, one row per test session, each timestamped so photos can inherit the latest snapshot and freshness can be scored.                                                                  |
| equipment_logs                        | Lighting/pump/dosing changes over time, so they can be overlaid on parameter graphs.                                                                                                                             |
| grid_slots                            | A physical location within a tank — now an X/Y/Z coordinate (footprint plus height), or a rack position.                                                                                                         |
| specimens                             | One row per individual coral — the center of the whole system.                                                                                                                                                   |
| coral_photos                          | Photos, public by default, each permanently stamped with the timestamped water conditions at the moment it was taken.                                                                                            |
| coral_aliases                         | Alternate hobbyist names for the same wiki entry.                                                                                                                                                                |
| id_suggestions / id_votes             | The community confirmation queue for identifying unlabeled corals.                                                                                                                                               |
| businesses                            | Billing and account details for shop accounts.                                                                                                                                                                   |
| qr_codes                              | One per grid slot — never needs reprinting.                                                                                                                                                                      |
| inquiries                             | “I’m interested” taps from a QR scan — never a real transaction.                                                                                                                                                 |
| want_list                             | What a hobbyist is looking to trade for.                                                                                                                                                                         |
| (new) naming hierarchy                | A 4-level taxonomy underpinning every wiki entry: L1 Coral (often hidden) → L2 genus (e.g. Acropora) → L3 species (e.g. Acropora millepora, may be hidden initially) → L4 hobbyist morph (e.g. “Pink Stardust”). |
| (new) element_profiles / color_ranges | Per-wiki-entry typical ranges for each identifiable element — corallite color, polyp color and size, skin color and profile, skeletal / growth shape — shown to users for self-identification.                   |
| (new) affiliate_links                 | Outbound vendor / coral-farmer URLs with referral tracking; no payment handling.                                                                                                                                 |
| provenance (protected)                | Lineage / chain-of-custody records, private by default and treated as a protected layer; expected to be incomplete.                                                                                              |

### 7.1 SQL changes still required (companion files — not yet applied)

These notes describe the edits the companion SQL files will need to match this amended spec. They are recorded here rather than applied, per the agreed scope (spec document only for now).

- coral_trait_schema.sql: add a 4-level naming hierarchy (coral → genus → species → morph) with visibility flags per level; add per-element typical color-range fields/tables for corallite color, polyp color and size, skin color and profile, and skeletal / growth shape.

- reef-platform-schema.sql: add username / email / external-profile link / region / state / zip to users; add dimensions and grid configuration to tanks; extend grid_slots to X/Y/Z; make coral_photos public-by-default; split lineage/provenance into a private, protected structure; add an affiliate_links table.

## 8. Glossary

- Specimen — one specific, individual coral that someone owns. Not the same as a species.

- Species / Morph (the “wiki entry”) — the reference page for a kind of coral, e.g. “Homewrecker Acropora.” Many specimens can point to one wiki entry.

- Naming Hierarchy — the 4-level structure behind every wiki entry: L1 Coral → L2 genus → L3 species → L4 hobbyist morph. Some levels may be hidden from users but always exist in the data.

- Element Profile / Color Range — the set of typical, tracked color and shape ranges for a coral’s identifiable parts (corallite, polyp, skin, skeleton/growth form), shown to users for self-identification.

- Lineage / Provenance — the documented chain of who a specimen was acquired from. A protected, private-by-default layer; not a genetic claim, and often incomplete.

- Parameter Freshness (Trust Signal) — the elapsed time between a photo and the parameter reading stamped on it; smaller gaps mean higher confidence in the pairing.

- Affiliate Link — an outbound link to a vendor or coral-farmer website that may earn a referral commission. No payment is processed on-platform.

- WYSIWYG (“What You See Is What You Get”) — a listing where the buyer gets the exact specimen pictured, not a generic same-type substitute.

- Grid Slot — a physical location within a tank (an X/Y/Z coordinate or a rack position) used for inventory placement.

- Inquiry — a customer’s expressed interest after scanning a QR code, not a purchase.

- Alias — an alternate name the community has attached to an existing wiki entry.

## 9. Open Decisions (Not Yet Determined)

Flagged here rather than guessed at, so they get a deliberate answer before launch:

- Final name / branding for the platform.

- Exact business subscription pricing and what “active specimen limit” tiers look like.

- Affiliate program specifics: which vendors / coral farmers to partner with and commission terms.

- Where the source data for typical element color ranges comes from (curated seed vs. derived from confirmed community photos).

- Default visibility of each naming-hierarchy level (which levels are hidden from users at launch).

- Moderation policy detail for disputed IDs and aliases.

- Home-tank grids now use X/Y/Z placement with captured dimensions and a user-chosen slot count *(resolved)*. Still to confirm: whether retail tanks default to a “precise” grid (A1, B2…) — likely yes, since frag racks are naturally row/column, but worth confirming with pilot shop staff before building.

- Local trade (Door 2) is now planned as a quiet, opt-in feature whose foundation (zip at signup) is built early and switched on in Phase 4 *(resolved)*. Remaining question: how aggressively to promote it once live.

**Companion file:** reef-platform-schema.sql

## Appendix A — Change Log (from review comments, 2026-07-04)

Every reviewer comment and how it was applied in this edition.

| **\#** | **Comment (summary)**                                                                                                                                                                 | **How it was applied**                                                                                                                                                  |
|--------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| C0     | Add identification profiles for coral elements (corallite color, skin profile/color, skeletal shape, polyp color & size) with typical, tracked color ranges visible for self-ID.      | Added element profiles + color ranges to Door 1, workflow 5.2, wiki pages (§6), schema map (§7) and glossary; noted as a Phase 3 differentiator with Phase 0 seed data. |
| C1     | Affiliate fees may be collected when a user navigates to a coral farmer’s website.                                                                                                    | Non-goals and revenue model in §1 now allow outbound affiliate/referral commissions; affiliate_links noted in §7.                                                       |
| C2     | Sourcing must be a protected layer; farmers won’t reveal sourcing, so chain-of-custody has gaps / completeness concerns.                                                              | Provenance made a private, protected layer (principle in §3, workflow 5.7, schema map §7) with an explicit data-completeness caveat.                                    |
| C3     | Maintain timestamped parameter logs so a posted photo already carries params; photo-vs-param time gap is a trust signal; profile links on local boards build trust and drive signups. | Added a timestamped-parameters principle (§3), freshness trust signal (5.2), and external profile link at signup (5.0).                                                 |
| C4     | Photos should be public first — valuable data capture.                                                                                                                                | Privacy principle rewritten: photos public by default (§3).                                                                                                             |
| C5     | Never claim absolute ID authority, but don’t rely only on “this frag came from that frag” — that fails as new corals are logged.                                                      | Provenance principle amended so identification stands on the naming hierarchy independently of lineage (§3).                                                            |
| C6     | Names must reach hobbyist level via a hierarchy: L1 Coral (may be hidden) → L2 Acropora → L3 Acropora millepora (may be hidden at first) → L4 Pink Stardust.                          | Added the 4-level naming hierarchy throughout (§6, §7, glossary); seeded in Phase 0.                                                                                    |
| C7     | Move specimen + photo logging to the Foundation layer.                                                                                                                                | Roadmap updated: specimen + photo logging now ships in Phase 0 (§4).                                                                                                    |
| C8     | Remove the photo opt-in — a photo is always public.                                                                                                                                   | Removed opt-in; Phase 2 and principles state photos are public by default (§3, §4).                                                                                     |
| C9     | Link to affiliate websites with commission; no payment handling in scope.                                                                                                             | Reflected in §1 revenue model and §4 Phase 2; in-platform payment remains out of scope.                                                                                 |
| C10    | Remove shipping (far-future at most).                                                                                                                                                 | Shipping removed entirely from the roadmap deferred list (§4).                                                                                                          |
| C11    | Add a user-setup section: username, password, Reef2Reef link, region, state, plus anything valuable for user identification.                                                          | Added workflow 5.0 “New user creates an account”.                                                                                                                       |
| C12    | Remove “(if the uploader opted in)” from ID confirmation.                                                                                                                             | Removed the opt-in condition in workflow 5.3.                                                                                                                           |
| C13    | Expand the Auth sitemap entry with account creation.                                                                                                                                  | Auth section renamed “Auth & Account Setup” with full profile fields (§6).                                                                                              |
| C14    | Home-tank grid needs X/Y/Z (height) placement; capture tank dimensions and how many slots the user wants.                                                                             | Workflow 5.1, grid_slots (§7) and Open Decisions updated for X/Y/Z, dimensions and slot count.                                                                          |
| C15    | Build local-trade foundation now but ship later; capture zip at signup for geo-matching.                                                                                              | Zip captured at signup (5.0); foundation in Phase 0/1, discovery in Phase 4 (§4, 5.4, §9).                                                                              |
