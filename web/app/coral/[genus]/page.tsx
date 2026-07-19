import { notFound } from "next/navigation";
import {
  getAllGenusSlugs,
  getAllMorphsForSearch,
  getGenera,
  getGenusBySlug,
  getGenusOnlyQueue,
  getGenusOptionsForIdentify,
  getHeroPhotoUrlsForTaxa,
  getMorphsForGenus,
  getPendingMorphsForGenus,
} from "@/lib/wiki";
import {
  CareDifficultyPill,
  CarePill,
  CompactColorKey,
  ColorTile,
  PendingPill,
  keyColors,
} from "@/components/coral-ui";
import { IdentifyQueue } from "@/components/identify-queue";
import { AddMorphCallout } from "@/components/add-morph-callout";

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

  const [morphs, genusOnlyQueue, allMorphs, allGenera, genusOptions, pendingMorphs] =
    await Promise.all([
      getMorphsForGenus(genus.id),
      getGenusOnlyQueue(genus.id),
      getAllMorphsForSearch(),
      getGenera(),
      getGenusOptionsForIdentify(),
      getPendingMorphsForGenus(genus.id),
    ]);
  const heroUrls = await getHeroPhotoUrlsForTaxa(morphs.map((m) => m.id));
  // Scope the "search existing corals" list to this genus's own morphs —
  // more relevant here than the full 100+-coral list /identify searches.
  const genusMorphs = allMorphs.filter((m) => m.genusSlug === genus.slug);

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

      <AddMorphCallout genusId={genus.id} genusName={genus.name} genusSlug={genus.slug} />

      {morphs.length === 0 && pendingMorphs.length === 0 ? (
        <p className="muted">No morphs seeded yet for this genus.</p>
      ) : (
        <div className="morph-list">
          {morphs.map((m) => {
            const heroUrl = heroUrls.get(m.id);
            return (
              <a
                className="morph-row"
                href={`/coral/${genus.slug}/${m.slug}`}
                key={m.id}
              >
                {heroUrl ? (
                  <div className="color-tile" style={{ overflow: "hidden" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={heroUrl}
                      alt={`${m.name} — representative photo`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </div>
                ) : (
                  <ColorTile colors={keyColors(m.color_ranges)} />
                )}
                <div className="morph-row-main">
                  <div className="name">{m.name}</div>
                  <CompactColorKey colorRanges={m.color_ranges} />
                </div>
                <div className="morph-row-pills">
                  <CareDifficultyPill code={m.care_difficulty_code} />
                  <CarePill kind="light" code={m.light_level_code} />
                  <CarePill kind="flow" code={m.flow_level_code} />
                </div>
              </a>
            );
          })}
          {pendingMorphs.map((p) => (
            <div className="morph-row morph-row-pending" key={p.suggestionId}>
              <div className="color-tile" style={{ overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.photoUrl}
                  alt={`${p.name} — proposed photo`}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
              <div className="morph-row-main">
                <div className="name">{p.name}</div>
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  Not yet confirmed — vote below
                </span>
              </div>
              <div className="morph-row-pills">
                <PendingPill />
              </div>
            </div>
          ))}
        </div>
      )}

      <h2>Photographed as {genus.name} — morph not yet pinned down</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Confirmed to the genus but not an exact morph yet. Recognize one?
        Propose the specific morph below and vote on others&apos; suggestions —
        a confirmed match moves the photo to its own morph page automatically.
      </p>
      <IdentifyQueue
        initialQueue={genusOnlyQueue}
        morphs={genusMorphs}
        genera={allGenera}
        genusOptions={genusOptions}
        hideUpload
        emptyMessage={`No photos are sitting at the ${genus.name} level right now.`}
      />
    </div>
  );
}
