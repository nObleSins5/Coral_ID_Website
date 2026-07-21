import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConfigureGridForm } from "@/components/configure-grid-form";
import { PlaceSpecimenControl } from "@/components/place-specimen-control";
import { QuickAddSpecimen } from "@/components/quick-add-specimen";
import { ResetGridButton } from "@/components/reset-grid-button";
import { TankGridInteractive } from "@/components/tank-grid-interactive";
import { TankPublishToggle } from "@/components/tank-publish-toggle";
import { TankBadgeToggle } from "@/components/tank-badge-toggle";
import { TankStatusBlock } from "@/components/tank-status-block";
import { TankPhotoGallery, type TankPhoto } from "@/components/tank-photo-gallery";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
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
  is_public: boolean;
  badge_enabled: boolean;
};
type GridSlot = {
  id: string;
  x: number;
  y: number;
  z: number;
  label: string;
  slot_type_code: string | null;
  disabled: boolean;
};
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
    .select("id, name, tank_type, volume, tier_count, grid_columns, grid_rows, is_public, badge_enabled")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!tank) notFound();
  const tankRow = tank as Tank;

  const { data: profile } = await supabase
    .from("users")
    .select("account_type_code")
    .eq("id", user.id)
    .maybeSingle();
  const isBusiness = profile?.account_type_code === "business";

  const { data: slots } = await supabase
    .from("grid_slots")
    .select("id, x, y, z, label, slot_type_code, disabled")
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

  const [allMorphs, allGenera, tankStatus, { data: tankPhotos }] = await Promise.all([
    getAllMorphsForSearch(),
    getGenera(),
    getTankStatus(supabase, id),
    supabase
      .from("tank_photos")
      .select("id, url, caption, uploader_user_id")
      .eq("tank_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
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

  const columns = tankRow.grid_columns;
  const rows = tankRow.grid_rows;
  const hasGrid = !!(columns && rows);
  const hasCoral = specimenList.length > 0;
  const hasEquipment = tankStatus.equipmentLogged;
  const onboardingDone = hasGrid && hasCoral && hasEquipment;

  // Flat data for TankGridInteractive (components/tank-grid-interactive.tsx)
  // — cell rendering/click-handling lives there now, this page just gathers
  // the data (same queries as before, tierGrids JSX no longer built here).
  const interactiveSlots = slotList.map((s) => ({
    id: s.id,
    x: s.x,
    y: s.y,
    z: s.z,
    label: s.label,
    slotTypeCode: s.slot_type_code,
    disabled: s.disabled,
  }));
  const occupantBySlotId = new Map(
    specimenList
      .filter((s) => s.grid_slot_id)
      .map((s) => [
        s.grid_slot_id as string,
        {
          specimenId: s.id,
          name: s.name,
          taxonName: s.taxon_nodes?.name ?? null,
          photoUrl: s.representative_photo_id ? photoUrlById.get(s.representative_photo_id) ?? null : null,
          href: taxonHref(s),
        },
      ]),
  );
  const unplacedOptions = unplaced.map((s) => ({
    specimenId: s.id,
    label: s.name || s.taxon_nodes?.name || "Unnamed coral",
    taxonId: s.taxon_node_id,
    taxonName: s.taxon_nodes?.name ?? null,
    representativePhotoId: s.representative_photo_id,
  }));

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

      {hasGrid && isBusiness ? (
        <TankPublishToggle tankId={tankRow.id} isPublic={tankRow.is_public} />
      ) : null}

      <TankBadgeToggle tankId={tankRow.id} badgeEnabled={tankRow.badge_enabled} />

      <h2>Tank photos</h2>
      <TankPhotoGallery
        tankId={tankRow.id}
        photos={(tankPhotos as TankPhoto[]) ?? []}
        isOwner
      />

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
          <TankGridInteractive
            tankId={tankRow.id}
            columns={columns as number}
            slots={interactiveSlots}
            occupantBySlotId={occupantBySlotId}
            unplaced={unplacedOptions}
            morphs={allMorphs}
            genera={allGenera}
          />

          <div style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
            <ResetGridButton tankId={tankRow.id} />
          </div>

          <h2 id="add-coral-section">Not yet in the grid</h2>
          <div style={{ marginBottom: "1rem" }}>
            <QuickAddSpecimen
              tankId={tankRow.id}
              emptySlots={emptySlots}
              morphs={allMorphs}
              genera={allGenera}
            />
          </div>
          {specimenList.length === 0 ? (
            <p className="muted">No corals in this tank yet — add one above.</p>
          ) : unplaced.length === 0 ? (
            <p className="muted">All your corals are placed in the grid.</p>
          ) : (
            <div className="card">
              {unplaced.map((s) => {
                const href = taxonHref(s);
                const label = s.name || s.taxon_nodes?.name || "Unnamed coral";
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
