import { getGenera, getGenusCategories } from "@/lib/wiki";

export const metadata = {
  title: "Coral Wiki — Reef Platform",
  description:
    "Browse corals by category and genus, drill into a morph, and compare its typical element colors for self-identification.",
};

function GenusCard({
  genus,
}: {
  genus: { id: string; name: string; slug: string; scientific_name: string | null; morph_count: number };
}) {
  return (
    <a className="genus-card" href={`/coral/${genus.slug}`}>
      <h3>{genus.name}</h3>
      {genus.scientific_name ? (
        <p className="muted" style={{ fontStyle: "italic", margin: "0 0 0.35rem" }}>
          {genus.scientific_name}
        </p>
      ) : null}
      <p className="muted">
        {genus.morph_count} {genus.morph_count === 1 ? "morph" : "morphs"}
      </p>
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
              <GenusCard genus={g} key={g.id} />
            ))}
          </div>
        )}
      </div>
    );
  }

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
              <GenusCard genus={g} key={g.id} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
