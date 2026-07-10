# Product

## Register

product

## Platform

web

## Users

Primary: reef aquarium hobbyists who keep a tank, log its water parameters and equipment, and want to identify and track the corals in it. They're mid-task, often on a phone next to the tank — checking a slot, logging a reading, snapping a photo. Secondary: business/vendor accounts, who post their own coral photos and list them for sale/trade through a separate managed dashboard rather than the hobbyist flow.

## Product Purpose

A community-driven platform for reef hobbyists to log tank parameters, equipment, and coral inventory — and to identify corals by comparing them against a wiki built from real, structured trait data (element-by-element hex colors, growth form, care difficulty) rather than a photo-lookalike guess. The tank grid, specimen tracking, and photo logging exist to build a crowdsourced dataset linking a coral's actual coloration to the real conditions that produced it.

## Positioning

The easiest way to identify a coral from a photo — by comparing it against structured, element-by-element trait data instead of scrolling lookalike photos.

## Brand Personality

Trustworthy and precise — a field guide, not a storefront. Confidence comes from accuracy (real hex colors sampled from real photos, real parameter ranges, real vote counts on an identification) rather than visual flash. Approachable, not clinical: it should read as an expert who's glad to help, not a lab instrument.

References, each for a specific reason:
- **Neptune Systems** — navy/white precision-hardware aesthetic; trust built from specific claims and real numbers ("billions of measurements a year," named customer testimonials) rather than decoration. The model for how this product should earn trust.
- **World Wide Corals** — ocean blues/teals with warm coral accents; product photography shot in both daylight and actinic (blue) lighting side by side, because lighting materially changes a coral's apparent color. Directly validates this project's own planned multi-lighting reference feature (see README) — this is the exact convention to draw from.
- **Top Shelf Aquatics** — same category as World Wide Corals (specialty coral retailer); referenced for the same premium-but-approachable coral-merchandising feel.
- **IMDb / Metacritic** — dense, structured entity pages: every title/coral is a detail page with cross-linked metadata (cast/crew ↔ genus/aliases, ratings ↔ vote counts, related titles ↔ related morphs). The model for how the coral wiki's morph pages and the tank/specimen pages should organize information — a reference database, not a marketing page.

No explicit anti-references were given. The existing light-theme design pass already made one relevant call worth preserving: hex colors and coral photography are legitimate *data*, not brand chrome — don't decorate with gradients or rainbow treatments the way a generic AI-generated SaaS dashboard would.

## Design Principles

- **Accuracy over decoration.** Trust is earned with real numbers and real photos (parameter ranges, vote counts, hex values), not visual flourish. When in doubt, show the data plainly rather than dressing it up.
- **Every entity is a reference page.** A coral morph, a tank, a specimen — each gets a dense, structured, cross-linked detail page (à la IMDb/Metacritic), not a marketing showcase.
- **Show the coral, not the chrome.** Coral photography and real coral color are the content. UI recedes around it — the coral itself should be the most saturated, most attention-grabbing thing on any given page.
- **Low friction for the core loop.** Success is measured by how much real tank/photo data gets logged, so the logging and identification flows should stay fast and low-friction even as the surrounding product grows.
- **Two audiences, one visual language.** Hobbyist and business/vendor workflows share the same design system but different affordances (personal dashboard vs. managed listings table) — never a bolted-on separate skin for one audience.

## Accessibility & Inclusion

WCAG AA.
