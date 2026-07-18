import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { TankGridView } from "@/components/tank-grid-view";
import { columnLabel } from "@/lib/grid";
import { getUsernamesFor } from "@/lib/wiki";

// Public, read-only tank showcase — a business account's grid, published via
// TankPublishToggle (app/tank/[id]/page.tsx) and gated by tanks.is_public
// (sql/supabase/28_public_tank_showcase.sql). No login required, no owner
// actions: every occupied cell links straight out to the real community wiki
// page for that coral (or its genus catch-all page, for a "genus only"
// specimen — see getGenusOnlyQueue) rather than the private /specimen/[id]
// route, since a visitor here never owns the tank.

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
    .eq("is_public", true)
    .maybeSingle();
  if (!tank) notFound();
  const tankRow = tank as Tank;

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
        {ownerNames.get(tankRow.user_id) ?? "a business member"}
      </p>

      {!hasGrid ? (
        <p className="muted">This tank doesn&apos;t have a grid configured yet.</p>
      ) : (
        <TankGridView tierGrids={tierGrids} />
      )}

      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Tap any coral above for its full wiki page — community photos, care difficulty, and
        recommended parameters.
      </p>
    </div>
  );
}
