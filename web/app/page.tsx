import {
  getAllMorphsForSearch,
  getCategoryOptions,
  getFeaturedMorphs,
  getGenera,
  getGenusOptionsForIdentify,
  getMorphBySlug,
} from "@/lib/wiki";
import { ElementColorKey } from "@/components/coral-ui";
import { QuickPostPhotoLauncher } from "@/components/quick-post-photo";
import { FeaturedScroll } from "@/components/featured-scroll";

// The showcase strip auto-scrolls through up to this many recent photos —
// see FeaturedScroll (components/featured-scroll.tsx) — instead of the old
// fixed 4-up grid, which spilled a 5th/6th card onto an awkward half-empty
// second row at common viewport widths.
const FEATURED_LIMIT = 20;

// The spotlight coral for the "old way vs. registry way" contrast below —
// a real, well-documented morph, not a fabricated example. Falls back
// gracefully (contrast section just omits the live data) if it's ever
// removed from the seed set.
const DIFFERENTIATOR_MORPH_SLUG = "walt-disney-acropora";

export default async function Home() {
  const [genera, featured, spotlight, morphs, categories, genusOptions] = await Promise.all([
    getGenera(),
    getFeaturedMorphs(FEATURED_LIMIT),
    getMorphBySlug(DIFFERENTIATOR_MORPH_SLUG),
    getAllMorphsForSearch(),
    getCategoryOptions(),
    getGenusOptionsForIdentify(),
  ]);

  const totalMorphs = genera.reduce((sum, g) => sum + g.morph_count, 0);
  const heroMorph =
    featured.find((m) => m.slug === DIFFERENTIATOR_MORPH_SLUG) ?? featured[0];

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-kicker">ReefCodex</p>
          <h1 className="hero-headline">
            Know your coral by its actual colors — not a guess.
          </h1>
          <p className="hero-sub">
            Tell us the shape and the colors you see — that&apos;s it. ReefCodex
            matches what you describe against real, element-by-element trait
            data, instead of making you scroll a feed of lookalike photos.
          </p>
          <div className="hero-actions">
            <a className="btn-primary-link" href="/identify">
              Identify it in 60 seconds →
            </a>
            <a className="btn-secondary-link" href="/wiki">
              Browse the wiki
            </a>
            <QuickPostPhotoLauncher morphs={morphs} categories={categories} genusOptions={genusOptions} />
          </div>
        </div>
        {heroMorph ? (
          <a
            className="hero-photo"
            href={`/coral/${heroMorph.genusSlug}/${heroMorph.slug}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroMorph.heroUrl}
              alt={`${heroMorph.name}, a ${heroMorph.genusName} — community photo`}
            />
            <span className="hero-photo-caption">
              {heroMorph.name} <span className="muted">({heroMorph.genusName})</span>
            </span>
          </a>
        ) : null}
      </section>

      <section className="differentiator">
        <div className="differentiator-old">
          <h2>The old way</h2>
          <p>
            Post a blurry photo to a forum or a Facebook group and wait for
            someone to guess — &quot;looks like a Walt Disney to me&quot; —
            based on whatever it happens to look like under their monitor&apos;s
            white balance.
          </p>
        </div>
        <div className="differentiator-new card">
          <h2>The registry way</h2>
          {spotlight ? (
            <>
              <p className="muted" style={{ marginTop: "-0.5rem" }}>
                Real sampled hex colors for {spotlight.name}, element by
                element:
              </p>
              <ElementColorKey colorRanges={spotlight.color_ranges} />
            </>
          ) : (
            <p className="muted">
              Every morph gets a structured, element-by-element color key —
              not a lookalike photo to eyeball.
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="showcase-heading">
          <h2>A living reference, one entry at a time</h2>
          <p className="muted">
            {totalMorphs} corals catalogued across {genera.length} genera —{" "}
            <a href="/wiki">browse them all →</a>
          </p>
        </div>
        {featured.length > 0 ? (
          <FeaturedScroll morphs={featured} />
        ) : (
          <p className="muted">
            No community photos yet —{" "}
            <a href="/identify">be the first to log one</a>.
          </p>
        )}
      </section>

      <section className="cta-band">
        <h2>Start logging your tank</h2>
        <p>
          Track parameters, place specimens on a grid, and help build the
          dataset one photo at a time.
        </p>
        <div className="hero-actions">
          <a className="btn-primary-link" href="/signup">
            Create an account
          </a>
          <a className="btn-secondary-link" href="/login">
            Log in
          </a>
        </div>
      </section>
    </div>
  );
}
