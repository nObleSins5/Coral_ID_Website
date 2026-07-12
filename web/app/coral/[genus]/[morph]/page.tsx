import { notFound } from "next/navigation";
import {
  getAccurateVoteCounts,
  getAffiliateLinksForTaxon,
  getAllGenusMorphSlugPairs,
  getMorphWithGenus,
  getPhotosForTaxon,
  getUsernamesFor,
} from "@/lib/wiki";
import { getCommentsForTaxon } from "@/lib/comments";
import { CoralCommentsSection } from "@/components/coral-comments-section";
import {
  CareDifficultyPill,
  CarePill,
  ColorTile,
  ElementColorKey,
  GROWTH_FORM,
  keyColors,
  PhotoCard,
} from "@/components/coral-ui";
import { AddPhotoForm } from "@/components/add-photo-form";
import { AddSpecimenForm } from "@/components/add-specimen-form";
import { PhotoVoteButton } from "@/components/photo-vote-button";
import { WishlistButton } from "@/components/wishlist-button";
import { ReportDeadLinkButton } from "@/components/report-dead-link-button";

const LINK_TYPE_LABEL: Record<string, string> = {
  wysiwyg: "Exact specimen pictured — may already be sold",
  representative: "This morph, typical example",
};

export async function generateStaticParams() {
  return getAllGenusMorphSlugPairs();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ genus: string; morph: string }>;
}) {
  const { genus, morph: morphSlug } = await params;
  const result = await getMorphWithGenus(genus, morphSlug);
  if (!result) return {};
  const { morph, genus: g } = result;
  return {
    title: `${morph.name} — ${g.name} — Coral Wiki`,
    description:
      morph.description ??
      `${morph.name}, a ${g.name} morph — care guidance and element color profile for self-identification.`,
  };
}

function paramRange(min: number | null, max: number | null, unit: string) {
  if (min == null && max == null) return "—";
  if (min != null && max != null) return `${min}–${max} ${unit}`;
  return `${min ?? max} ${unit}`;
}

export default async function MorphPage({
  params,
}: {
  params: Promise<{ genus: string; morph: string }>;
}) {
  const { genus: genusSlug, morph: morphSlug } = await params;
  const result = await getMorphWithGenus(genusSlug, morphSlug);
  if (!result) notFound();
  const { morph, genus, templateElementCodes } = result;

  const colors = keyColors(morph.color_ranges);
  const photos = await getPhotosForTaxon(morph.id);
  const voteCounts = await getAccurateVoteCounts(photos.map((p) => p.id));
  const usernames = await getUsernamesFor(photos.map((p) => p.uploader_user_id));
  const affiliateLinks = await getAffiliateLinksForTaxon(morph.id);
  const comments = await getCommentsForTaxon(morph.id);

  // Hero = most-voted photo, computed live (no cached counter/batch job —
  // trivial at this scale). photos is already newest-first, and we only
  // replace on a STRICTLY higher count, so ties resolve to the newest photo.
  let heroPhoto: (typeof photos)[number] | null = null;
  let heroVotes = -1;
  for (const p of photos) {
    const v = voteCounts.get(p.id) ?? 0;
    if (v > heroVotes) {
      heroVotes = v;
      heroPhoto = p;
    }
  }

  return (
    <div>
      <p className="breadcrumb">
        <a href="/wiki">Coral wiki</a> / <a href={`/coral/${genus.slug}`}>{genus.name}</a> /{" "}
        {morph.name}
      </p>

      <h1 style={{ marginBottom: "0.15rem" }}>{morph.name}</h1>
      {morph.scientific_name ? (
        <p className="muted" style={{ fontStyle: "italic", marginTop: 0 }}>
          {morph.scientific_name}
        </p>
      ) : null}

      <div className="morph-row-pills" style={{ marginBottom: "1.25rem" }}>
        <CareDifficultyPill code={morph.care_difficulty_code} />
        <CarePill kind="light" code={morph.light_level_code} />
        <CarePill kind="flow" code={morph.flow_level_code} />
        {morph.growth_form_code ? (
          <span className="pill">
            {GROWTH_FORM[morph.growth_form_code] ?? morph.growth_form_code}
          </span>
        ) : null}
      </div>

      {/* Both calls to action sit right under the identity/pills row, ahead
          of the params/color-key reference block — a hobbyist deciding
          "I have this coral" shouldn't have to scroll past a data table to
          act on it. Each form collapses to a single button until clicked. */}
      <div className="morph-actions-row">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>My collection</h2>
          <div className="collection-actions-row">
            <AddSpecimenForm
              taxonNodeId={morph.id}
              taxonName={morph.name}
              genusSlug={genus.slug}
              morphSlug={morph.slug}
              photos={photos.map((p) => ({
                id: p.id,
                url: p.url,
                uploader_user_id: p.uploader_user_id,
              }))}
            />
            <WishlistButton
              taxonNodeId={morph.id}
              genusSlug={genus.slug}
              morphSlug={morph.slug}
            />
          </div>
        </div>

        <div className="card" id="add-photo-section">
          <h2 style={{ marginTop: 0 }}>Community photos</h2>
          <AddPhotoForm
            taxonNodeId={morph.id}
            genusSlug={genus.slug}
            morphSlug={morph.slug}
          />
        </div>
      </div>

      <div className="detail-grid">
        <div>
          {heroPhoto ? (
            <div className="photo-tile large">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroPhoto.url} alt="" />
              <span className="freshness-badge">
                Community favorite
                {heroVotes > 0
                  ? ` · ${heroVotes} confirm${heroVotes === 1 ? "" : "s"}`
                  : ""}
              </span>
            </div>
          ) : (
            <ColorTile colors={colors} label="Placeholder — no photos yet" large />
          )}
          {morph.description ? <p>{morph.description}</p> : null}
          {morph.placement ? (
            <p className="muted">
              <strong className="muted">Placement:</strong> {morph.placement}
            </p>
          ) : null}

          <h2>Recommended parameters</h2>
          <table className="param-table">
            <tbody>
              <tr>
                <td>Alkalinity</td>
                <td>{paramRange(morph.rec_alkalinity_dkh_min, morph.rec_alkalinity_dkh_max, "dKH")}</td>
              </tr>
              <tr>
                <td>Calcium</td>
                <td>{paramRange(morph.rec_calcium_ppm_min, morph.rec_calcium_ppm_max, "ppm")}</td>
              </tr>
              <tr>
                <td>Magnesium</td>
                <td>{paramRange(morph.rec_magnesium_ppm_min, morph.rec_magnesium_ppm_max, "ppm")}</td>
              </tr>
              <tr>
                <td>Nitrate</td>
                <td>{paramRange(morph.rec_nitrate_ppm_min, morph.rec_nitrate_ppm_max, "ppm")}</td>
              </tr>
              <tr>
                <td>Phosphate</td>
                <td>{paramRange(morph.rec_phosphate_ppm_min, morph.rec_phosphate_ppm_max, "ppm")}</td>
              </tr>
              <tr>
                <td>Temperature</td>
                <td>{paramRange(morph.rec_temperature_c_min, morph.rec_temperature_c_max, "°C")}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h2 style={{ marginTop: 0 }}>Element color key</h2>
          <p className="muted" style={{ marginTop: "-0.5rem" }}>
            Compare each part of your coral against these documented colors.
          </p>
          <ElementColorKey
            colorRanges={morph.color_ranges}
            suggestedPositions={templateElementCodes.length > 0 ? templateElementCodes : undefined}
          />
        </div>
      </div>

      <h2>All community photos</h2>
      {photos.length === 0 ? (
        <p className="muted">
          No photos yet — be the first to log one above. Each photo can be
          stamped with the water parameters running in your tank at the time.
        </p>
      ) : (
        <div className="photo-grid">
          {photos.map((p) => (
            <PhotoCard
              key={p.id}
              photo={p}
              username={usernames.get(p.uploader_user_id) ?? "A hobbyist"}
              voteCount={voteCounts.get(p.id) ?? 0}
              genusSlug={genus.slug}
              morphSlug={morph.slug}
              morphName={morph.name}
              VoteButton={PhotoVoteButton}
            />
          ))}
        </div>
      )}

      <h2>Where to find it</h2>
      {affiliateLinks.length === 0 ? (
        <div className="card stub-card">
          <p>
            No vendor links yet. Vendors who showcase this morph in their own
            photos will appear here once they add one.
          </p>
        </div>
      ) : (
        <div className="affiliate-link-grid">
          {affiliateLinks.map((link) => (
            <div className="card affiliate-link-card" key={link.id}>
              <p style={{ marginTop: 0, fontWeight: 600 }}>{link.vendor_name}</p>
              <p className="muted" style={{ marginTop: 0, fontSize: "0.8rem" }}>
                {LINK_TYPE_LABEL[link.link_type] ?? link.link_type}
              </p>
              <p style={{ marginTop: 0, fontSize: "0.85rem" }}>
                {link.for_sale_or_trade
                  ? link.price != null
                    ? `$${link.price.toFixed(2)}`
                    : "For sale/trade"
                  : "Not currently for sale"}
              </p>
              <div className="affiliate-link-actions">
                <a href={`/go/${link.id}`} target="_blank" rel="noopener nofollow sponsored">
                  Visit vendor →
                </a>
                <ReportDeadLinkButton
                  linkId={link.id}
                  genusSlug={genus.slug}
                  morphSlug={morph.slug}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <h2>Discussion</h2>
      <CoralCommentsSection
        taxonNodeId={morph.id}
        genusSlug={genus.slug}
        morphSlug={morph.slug}
        initialComments={comments}
      />
    </div>
  );
}
