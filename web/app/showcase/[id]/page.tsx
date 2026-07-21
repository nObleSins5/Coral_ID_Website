import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { TankGridView } from "@/components/tank-grid-view";
import { columnLabel } from "@/lib/grid";
import { getUsernamesFor } from "@/lib/wiki";
import { getBadgeData, PARAM_META, type ParamKey } from "@/lib/tank-callouts";
import { TankPhotoGallery, type TankPhoto } from "@/components/tank-photo-gallery";

// Public, read-only tank page — gated by EITHER tanks.is_public (a business
// account's full grid, published via TankPublishToggle) OR
// tanks.badge_enabled (any account's parameters + species list, published
// via TankBadgeToggle — see sql/supabase/32_tank_badge.sql). No login
// required, no owner actions: every occupied cell/species link goes straight
// to the real community wiki page for that coral (or its genus catch-all
// page, for a "genus only" specimen — see getGenusOnlyQueue) rather than the
// private /specimen/[id] route, since a visitor here never owns the tank.

const PARAM_ORDER: ParamKey[] = [
  "alkalinity_dkh",
  "calcium_ppm",
  "magnesium_ppm",
  "nitrate_ppm",
  "phosphate_ppm",
];

type Tank = {
  id: string;
  name: string;
  tank_type: string | null;
  volume: number | null;
  tier_count: number;
  grid_columns: number | null;
  grid_rows: number | null;
  user_id: string;
};
type GridSlot = { id: string; x: number; y: number; z: number; label: string };
type Specimen = {
  id: string;
  name: string | null;
  grid_slot_id: string | null;
  representative_photo_id: string | null;
  taxon_nodes: { name: string; slug: string; parent_id: string | null; rank_code: string } | null;
};

export default async function TankShowcasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createPublicClient();

  const { data: tank } = await supabase
    .from("tanks")
    .select("id, name, tank_type, volume, tier_count, grid_columns, grid_rows, user_id")
    .eq("id", id)
    .or("is_public.eq.true,badge_enabled.eq.true")
    .maybeSingle();
  if (!tank) notFound();
  const tankRow = tank as Tank;

  const badgeData = await getBadgeData(supabase, id);
  const paramEntries = badgeData?.latestReading
    ? PARAM_ORDER.map((key) => ({ key, value: badgeData.latestReading![key] })).filter(
        (p): p is { key: ParamKey; value: number } => p.value != null,
      )
    : [];

  const { data: slots } = await supabase
    .from("grid_slots")
    .select("id, x, y, z, label")
    .eq("tank_id", id)
    .order("z", { ascending: true })
    .order("y", { ascending: true })
    .order("x", { ascending: true });
  const slotList = (slots ?? []) as GridSlot[];

  const { data: specimens } = await supabase
    .from("specimens")
    .select(
      "id, name, grid_slot_id, representative_photo_id, taxon_nodes ( name, slug, parent_id, rank_code )",
    )
    .eq("tank_id", id)
    .is("deleted_at", null);
  const specimenList = (specimens ?? []) as unknown as Specimen[];

  // A morph's link needs its parent genus's slug; a genus targeted directly
  // (rank_code "genus" — see getGenusOnlyQueue) links to its own slug and has
  // no morph segment to add.
  const genusIds = [
    ...new Set(
      specimenList
        .map((s) => s.taxon_nodes)
        .filter((t): t is NonNullable<Specimen["taxon_nodes"]> => !!t && t.rank_code !== "genus")
        .map((t) => t.parent_id)
        .filter((x): x is string => !!x),
    ),
  ];
  const { data: genera } =
    genusIds.length > 0
      ? await supabase.from("taxon_nodes").select("id, slug").in("id", genusIds)
      : { data: [] as { id: string; slug: string }[] };
  const genusSlugById = new Map((genera ?? []).map((g) => [g.id, g.slug]));

  const photoIds = [
    ...new Set(specimenList.map((s) => s.representative_photo_id).filter((x): x is string => !!x)),
  ];
  const { data: photos } =
    photoIds.length > 0
      ? await supabase.from("coral_photos").select("id, url").in("id", photoIds).eq("is_public", true)
      : { data: [] as { id: string; url: string }[] };
  const photoUrlById = new Map((photos ?? []).map((p) => [p.id, p.url]));

  const ownerNames = await getUsernamesFor([tankRow.user_id]);

  const { data: tankPhotos } = await supabase
    .from("tank_photos")
    .select("id, url, caption, uploader_user_id")
    .eq("tank_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  function taxonHref(s: Specimen) {
    const taxon = s.taxon_nodes;
    if (!taxon) return null;
    if (taxon.rank_code === "genus") return `/coral/${taxon.slug}`;
    const genusSlug = taxon.parent_id ? genusSlugById.get(taxon.parent_id) : null;
    return genusSlug ? `/coral/${genusSlug}/${taxon.slug}` : null;
  }

  const specimenBySlot = new Map(
    specimenList.filter((s) => s.grid_slot_id).map((s) => [s.grid_slot_id as string, s]),
  );

  const tiers = tankRow.tier_count ?? 1;
  const columns = tankRow.grid_columns;
  const rows = tankRow.grid_rows;
  const hasGrid = !!(columns && rows);

  const tierGrids = hasGrid
    ? Array.from({ length: tiers }, (_, i) => i + 1).map((z) => (
        <div className="tank-grid-tier" key={z}>
          <div
            className="tank-grid"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(70px, 1fr))` }}
          >
            {slotList
              .filter((slot) => slot.z === z)
              .map((slot) => {
                const specimen = specimenBySlot.get(slot.id);
                const photoUrl = specimen?.representative_photo_id
                  ? photoUrlById.get(specimen.representative_photo_id)
                  : null;
                const href = specimen ? taxonHref(specimen) : null;
                const label = specimen ? specimen.taxon_nodes?.name ?? specimen.name ?? "Unidentified" : null;
                return (
                  <div
                    key={slot.id}
                    className={`tank-grid-cell ${specimen ? "occupied" : "empty"}`}
                  >
                    <span className="slot-label">
                      {columnLabel(slot.x)}
                      {slot.y}
                    </span>
                    {specimen ? (
                      <>
                        {photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photoUrl} alt="" className="tank-grid-cell-thumb" />
                        ) : null}
                        {href ? <a href={href}>{label}</a> : <span>{label}</span>}
                      </>
                    ) : (
                      <span>Empty</span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      ))
    : [];

  return (
    <div>
      <p className="breadcrumb">Tank showcase</p>
      <h1 style={{ marginBottom: "0.15rem" }}>{tankRow.name}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {tankRow.tank_type ? `${tankRow.tank_type} · ` : ""}
        {tankRow.volume ? `${tankRow.volume} gal` : ""}
        {" · Presented by "}
        {ownerNames.get(tankRow.user_id) ?? "a ReefCodex member"}
      </p>

      {paramEntries.length > 0 ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <p style={{ marginTop: 0, marginBottom: "0.5rem", fontWeight: 600 }}>
            Current parameters
          </p>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {paramEntries.map((p) => (
              <div key={p.key}>
                <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
                  {PARAM_META[p.key].label}
                </p>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {p.value} {PARAM_META[p.key].unit}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!hasGrid ? (
        specimenList.length > 0 ? (
          <div className="card" style={{ marginBottom: "1rem" }}>
            <p style={{ marginTop: 0, marginBottom: "0.5rem", fontWeight: 600 }}>
              Species in this tank
            </p>
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
              {specimenList.map((s) => {
                const href = taxonHref(s);
                const label = s.taxon_nodes?.name ?? s.name ?? "Unidentified";
                return (
                  <li key={s.id}>{href ? <a href={href}>{label}</a> : label}</li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="muted">No corals catalogued in this tank yet.</p>
        )
      ) : (
        <TankGridView tierGrids={tierGrids} />
      )}

      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Tap any coral above for its full wiki page — community photos, care difficulty, and
        recommended parameters.
      </p>

      {tankPhotos && tankPhotos.length > 0 ? (
        <>
          <h2>Tank photos</h2>
          <TankPhotoGallery tankId={id} photos={tankPhotos as TankPhoto[]} isOwner={false} />
        </>
      ) : null}
    </div>
  );
}
