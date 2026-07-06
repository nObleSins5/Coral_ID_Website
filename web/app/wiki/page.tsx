import { getGenera } from "@/lib/wiki";

export const metadata = {
  title: "Coral Wiki — Reef Platform",
  description:
    "Browse corals by genus, drill into a morph, and compare its typical element colors for self-identification.",
};

export default async function WikiIndex() {
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
            <a className="genus-card" href={`/coral/${g.slug}`} key={g.id}>
              <h3>{g.name}</h3>
              {g.scientific_name ? (
                <p className="muted" style={{ fontStyle: "italic", margin: "0 0 0.35rem" }}>
                  {g.scientific_name}
                </p>
              ) : null}
              <p className="muted">
                {g.morph_count} {g.morph_count === 1 ? "morph" : "morphs"}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
