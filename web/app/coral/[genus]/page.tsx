import { notFound } from "next/navigation";
import {
  getAllGenusSlugs,
  getGenusBySlug,
  getMorphsForGenus,
} from "@/lib/wiki";
import {
  CareDifficultyPill,
  CarePill,
  CompactColorKey,
  ColorTile,
  keyColors,
} from "@/components/coral-ui";

export async function generateStaticParams() {
  const slugs = await getAllGenusSlugs();
  return slugs.map((genus) => ({ genus }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ genus: string }>;
}) {
  const { genus: genusSlug } = await params;
  const genus = await getGenusBySlug(genusSlug);
  if (!genus) return {};
  return {
    title: `${genus.name} — Coral Wiki`,
    description: `Morphs of ${genus.name}${genus.scientific_name ? ` (${genus.scientific_name})` : ""} — care guidance and element color profiles for self-identification.`,
  };
}

export default async function GenusPage({
  params,
}: {
  params: Promise<{ genus: string }>;
}) {
  const { genus: genusSlug } = await params;
  const genus = await getGenusBySlug(genusSlug);
  if (!genus) notFound();

  const morphs = await getMorphsForGenus(genus.id);

  return (
    <div>
      <p className="breadcrumb">
        <a href="/wiki">Coral wiki</a> / {genus.name}
      </p>
      <h1>
        {genus.name}
        {genus.scientific_name ? (
          <span className="muted" style={{ fontWeight: 400, fontStyle: "italic", fontSize: "1rem" }}>
            {" "}
            · {genus.scientific_name}
          </span>
        ) : null}
      </h1>

      {morphs.length === 0 ? (
        <p className="muted">No morphs seeded yet for this genus.</p>
      ) : (
        <div className="morph-list">
          {morphs.map((m) => (
            <a
              className="morph-row"
              href={`/coral/${genus.slug}/${m.slug}`}
              key={m.id}
            >
              <ColorTile colors={keyColors(m.element_profiles)} />
              <div className="morph-row-main">
                <div className="name">{m.name}</div>
                <CompactColorKey elements={m.element_profiles} />
              </div>
              <div className="morph-row-pills">
                <CareDifficultyPill code={m.care_difficulty_code} />
                <CarePill kind="light" code={m.light_level_code} />
                <CarePill kind="flow" code={m.flow_level_code} />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
