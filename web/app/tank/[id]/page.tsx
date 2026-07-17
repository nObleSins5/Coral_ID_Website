import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConfigureGridForm } from "@/components/configure-grid-form";
import { PlaceSpecimenControl } from "@/components/place-specimen-control";
import { QuickAddSpecimen } from "@/components/quick-add-specimen";
import { ResetGridButton } from "@/components/reset-grid-button";
import { TankGridView } from "@/components/tank-grid-view";
import { TankStatusBlock } from "@/components/tank-status-block";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { columnLabel } from "@/lib/grid";
import { getAllMorphsForSearch, getGenera } from "@/lib/wiki";
import { getTankStatus } from "@/lib/tank-callouts";

type Tank = {
  id: string;
  name: string;
  tank_type: string | null;
  volume: number | null;
  tier_count: number;
  grid_columns: number | null;
  grid_rows: number | null;
};
type GridSlot = { id: string; x: number; y: number; z: number; label: string };
type Specimen = {
  id: string;
  name: string | null;
  grid_slot_id: string | null;
  taxon_node_id: string | null;
  representative_photo_id: string | null;
  taxon_nodes: { name: string; slug: string; parent_id: string | null } | null;
};

export default async function TankPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tank } = await supabase
    .from("tanks")
    .select("id, name, tank_type, volume, tier_count, grid_columns, grid_rows")
    .eq("id", id)
    .eq("user_id", user.id)
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
      "id, name, grid_slot_id, taxon_node_id, representative_photo_id, taxon_nodes ( name, slug, parent_id )",
    )
    .eq("tank_id", id)
    .is("deleted_at", null);
  const specimenList = (specimens ?? []) as unknown as Specimen[];

  const genusIds = [
    ...new Set(
      specimenList
        .map((s) => s.taxon_nodes?.parent_id)
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
      ? await supabase.from("coral_photos").select("id, url").in("id", photoIds)
      : { data: [] as { id: string; url: string }[] };
  const photoUrlById = new Map((photos ?? []).map((p) => [p.id, p.url]));

  const [allMorphs, allGenera, tankStatus] = await Promise.all([
    getAllMorphsForSearch(),
    getGenera(),
    getTankStatus(supabase, id),
  ]);

  const specimenBySlot = new Map(
    specimenList.filter((s) => s.grid_slot_id).map((s) => [s.grid_slot_id as string, s]),
  );
  const unplaced = specimenList.filter((s) => !s.grid_slot_id);
  const emptySlots = slotList
    .filter((s) => !specimenBySlot.has(s.id))
    .map((s) => ({ id: s.id, label: s.label }));

  function taxonHref(s: Specimen) {
    const genusSlug = s.taxon_nodes?.parent_id
      ? genusSlugById.get(s.taxon_nodes.parent_id)
      : null;
    return genusSlug && s.taxon_nodes ? `/coral/${genusSlug}/${s.taxon_nodes.slug}` : null;
  }

  const tiers = tankRow.tier_count ?? 1;
  const columns = tankRow.grid_columns;
  const rows = tankRow.grid_rows;
  const hasGrid = !!(columns && rows);
  const hasCoral = specimenList.length > 0;
  const hasEquipment = tankStatus.equipmentLogged;
  const onboardingDone = hasGrid && hasCoral && hasEquipment;

  const tierGrids = Array.from({ length: tiers }, (_, i) => i + 1).map((z) => (
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
                    <a href={`/specimen/${specimen.id}`}>
                      {specimen.name || specimen.taxon_nodes?.name || "Specimen"}
                    </a>
                  </>
                ) : (
                  <span>Empty</span>
                )}
              </div>
            );
          })}
      </div>
    </div>
  ));

  return (
    <div>
      <p className="breadcrumb">
        <a href="/dashboard">Your tanks</a> / {tankRow.name}
      </p>
      <h1 style={{ marginBottom: "0.15rem" }}>{tankRow.name}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {tankRow.tank_type ? `${tankRow.tank_type} · ` : ""}
        {tankRow.volume ? `${tankRow.volume} gal` : ""}
        {" · "}
        <a href={`/tank/${tankRow.id}/husbandry`}>Equipment &amp; dosing</a>
      </p>

      {hasGrid ? (
        onboardingDone ? (
          <TankStatusBlock status={tankStatus} husbandryHref={`/tank/${tankRow.id}/husbandry`} />
        ) : (
          <OnboardingChecklist
            hasCoral={hasCoral}
            hasEquipment={hasEquipment}
            addCoralHref="#add-coral-section"
            husbandryHref={`/tank/${tankRow.id}/husbandry`}
          />
        )
      ) : null}

      {!hasGrid ? (
        <ConfigureGridForm tankId={tankRow.id} />
      ) : (
        <>
          <TankGridView tierGrids={tierGrids} />

          <div style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
            <ResetGridButton tankId={tankRow.id} />
          </div>

          <h2 id="add-coral-section">Unplaced specimens</h2>
          <div style={{ marginBottom: "1rem" }}>
            <QuickAddSpecimen
              tankId={tankRow.id}
              emptySlots={emptySlots}
              morphs={allMorphs}
              genera={allGenera}
            />
          </div>
          {unplaced.length === 0 ? (
            <p className="muted">Everything in this tank is placed in the grid.</p>
          ) : (
            <div className="card">
              {unplaced.map((s) => {
                const href = taxonHref(s);
                const label = s.name || s.taxon_nodes?.name || "Specimen";
                return (
                  <div className="unplaced-specimen-row" key={s.id}>
                    <div>
                      <a href={`/specimen/${s.id}`}>{label}</a>
                      {s.name && href ? (
                        <span className="muted">
                          {" "}
                          · <a href={href}>{s.taxon_nodes?.name}</a>
                        </span>
                      ) : null}
                    </div>
                    <PlaceSpecimenControl specimenId={s.id} emptySlots={emptySlots} />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
