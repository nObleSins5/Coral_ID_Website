import { getGenera, getGenusCategories, getGenusHeroPhotos } from "@/lib/wiki";

export const metadata = {
  title: "Coral Wiki — ReefCodex",
  description:
    "Browse corals by category and genus, drill into a morph, and compare its typical element colors for self-identification.",
};

// Genus card's background photo — the single most-voted photo across every
// morph in the genus (getGenusHeroPhotos), not one specific morph's photo.
// Cropped/repositioned with plain CSS (background-size + background-position,
// no image processing needed): zoomed to ~200% crops out roughly the outer
// half of the frame, keeping the visual center; position shifts that center
// toward the right two-thirds of the card. A same-color scrim (the card's
// own background, opaque -> transparent) fades the flat left side into the
// photo — deliberately NOT a decorative two-hue gradient (DESIGN.md bans
// those; the only gradients elsewhere in this app are real coral color
// data). Genera with no real photo yet render as today's plain flat card.
function GenusCard({
  genus,
  heroUrl,
}: {
  genus: { id: string; name: string; slug: string; scientific_name: string | null; morph_count: number };
  heroUrl?: string;
}) {
  return (
    <a
      className={`genus-card${heroUrl ? " has-photo" : ""}`}
      href={`/coral/${genus.slug}`}
      style={heroUrl ? { backgroundImage: `url(${heroUrl})` } : undefined}
    >
      <div className="genus-card-scrim">
        <h3>{genus.name}</h3>
        <p className="muted">
          {genus.morph_count} {genus.morph_count === 1 ? "morph" : "morphs"}
        </p>
      </div>
    </a>
  );
}

export default async function WikiIndex() {
  const categories = await getGenusCategories();

  // Falls back to the flat genus list if no genus has a real category
  // parent yet — e.g. sql/supabase/24_coral_categories.sql hasn't been
  // applied to this database. Keeps the index usable instead of silently
  // showing "no genera" during the window between a code deploy and the
  // migration that makes this grouping possible.
  if (categories.length === 0) {
    const genera = await getGenera();
    const heroPhotos = await getGenusHeroPhotos(genera.map((g) => g.id));
    return (
      <div>
        <h1>Coral wiki</h1>
        <p className="muted">
          Browse by genus, then drill into a specific morph to compare its
          typical element colors against your own coral.
        </p>
        {genera.length === 0 ? (
          <p className="muted">No genera seeded yet.</p>
        ) : (
          <div className="genus-grid">
            {genera.map((g) => (
              <GenusCard genus={g} heroUrl={heroPhotos.get(g.id)} key={g.id} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const heroPhotos = await getGenusHeroPhotos(categories.flatMap((c) => c.genera.map((g) => g.id)));

  return (
    <div>
      <h1>Coral wiki</h1>
      <p className="muted">
        Browse by category, then genus, then drill into a specific morph to
        compare its typical element colors against your own coral.
      </p>

      {categories.map((c) => (
        <details className="category-section" key={c.id} open>
          <summary className="category-summary">
            {c.name}{" "}
            <span className="muted" style={{ fontWeight: 400 }}>
              ({c.genera.length} {c.genera.length === 1 ? "genus" : "genera"})
            </span>
          </summary>
          <div className="genus-grid">
            {c.genera.map((g) => (
              <GenusCard genus={g} heroUrl={heroPhotos.get(g.id)} key={g.id} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
