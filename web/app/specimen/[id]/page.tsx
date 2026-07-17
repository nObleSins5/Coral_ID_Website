import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllMorphsForSearch, getGenera, getPhotosForTaxon } from "@/lib/wiki";
import { EditSpecimenForm } from "@/components/edit-specimen-form";
import { PlaceSpecimenControl } from "@/components/place-specimen-control";
import { RemoveFromTankButton } from "@/components/remove-from-tank-button";
import { SpecimenProposeControl } from "@/components/specimen-propose-control";

type SpecimenRow = {
  id: string;
  name: string | null;
  acquired_on: string | null;
  taxon_node_id: string | null;
  grid_slot_id: string | null;
  representative_photo_id: string | null;
  tank_id: string | null;
  taxon_nodes: { name: string; slug: string; parent_id: string | null } | null;
  tanks: { id: string; name: string } | null;
};

export default async function SpecimenPage({
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

  const { data: specimen } = await supabase
    .from("specimens")
    .select(
      "id, name, acquired_on, taxon_node_id, grid_slot_id, representative_photo_id, tank_id, taxon_nodes ( name, slug, parent_id ), tanks ( id, name )",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!specimen) notFound();
  const row = specimen as unknown as SpecimenRow;

  const genusSlug = row.taxon_nodes?.parent_id
    ? (
        await supabase
          .from("taxon_nodes")
          .select("slug")
          .eq("id", row.taxon_nodes.parent_id)
          .maybeSingle()
      ).data?.slug ?? null
    : null;
  const taxonHref =
    genusSlug && row.taxon_nodes ? `/coral/${genusSlug}/${row.taxon_nodes.slug}` : null;

  const photos = row.taxon_node_id ? await getPhotosForTaxon(row.taxon_node_id) : [];
  // Looked up directly by id (not via getPhotosForTaxon, which is empty for a
  // taxon-less specimen) so a private/local representative photo still shows.
  const { data: representativePhoto } = row.representative_photo_id
    ? await supabase
        .from("coral_photos")
        .select("id, url")
        .eq("id", row.representative_photo_id)
        .maybeSingle()
    : { data: null };

  const [morphs, genera] = await Promise.all([getAllMorphsForSearch(), getGenera()]);

  let currentSlotLabel: string | null = null;
  let emptySlots: { id: string; label: string }[] = [];
  let tankHasGrid = false;
  if (row.tank_id) {
    const { data: slots } = await supabase
      .from("grid_slots")
      .select("id, label")
      .eq("tank_id", row.tank_id);
    tankHasGrid = (slots ?? []).length > 0;
    const { data: occupied } = await supabase
      .from("specimens")
      .select("grid_slot_id")
      .eq("tank_id", row.tank_id)
      .is("deleted_at", null)
      .not("grid_slot_id", "is", null);
    const occupiedIds = new Set((occupied ?? []).map((o) => o.grid_slot_id as string));
    for (const s of slots ?? []) {
      if (s.id === row.grid_slot_id) currentSlotLabel = s.label;
    }
    emptySlots = (slots ?? [])
      .filter((s) => !occupiedIds.has(s.id) || s.id === row.grid_slot_id)
      .filter((s) => s.id !== row.grid_slot_id)
      .map((s) => ({ id: s.id, label: s.label }));
  }

  const label = row.name || row.taxon_nodes?.name || "Unnamed coral";

  return (
    <div>
      <p className="breadcrumb">
        <a href="/dashboard">Your tanks</a>
        {row.tank_id && row.tanks ? (
          <>
            {" "}
            / <a href={`/tank/${row.tank_id}`}>{row.tanks.name}</a>
          </>
        ) : null}{" "}
        / {label}
      </p>
      <h1 style={{ marginBottom: "0.15rem" }}>{label}</h1>
      {row.taxon_nodes ? (
        <p className="muted" style={{ marginTop: 0 }}>
          {taxonHref ? <a href={taxonHref}>{row.taxon_nodes.name}</a> : row.taxon_nodes.name}
        </p>
      ) : null}

      {representativePhoto ? (
        <>
          <div className="photo-tile large">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={representativePhoto.url} alt={`${label} — representative photo`} />
          </div>
          {!row.taxon_node_id ? (
            <p style={{ marginTop: "0.6rem" }}>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                Just a local label right now — not on the wiki.{" "}
              </span>
              <SpecimenProposeControl
                photoId={row.representative_photo_id as string}
                photoUrl={representativePhoto.url}
                morphs={morphs}
                genera={genera}
              />
            </p>
          ) : null}
        </>
      ) : (
        <p className="muted">
          No representative photo chosen yet — pick one below.
        </p>
      )}

      <h2>Placement</h2>
      <div className="card">
        {row.tank_id ? (
          currentSlotLabel ? (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                Currently in slot <strong>{currentSlotLabel}</strong>.
              </p>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
                <PlaceSpecimenControl
                  specimenId={row.id}
                  emptySlots={emptySlots}
                  actionLabel="Move"
                />
                <RemoveFromTankButton specimenId={row.id} />
              </div>
            </>
          ) : tankHasGrid ? (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                Not currently placed in {row.tanks?.name ?? "the tank"}&apos;s grid.
              </p>
              <PlaceSpecimenControl specimenId={row.id} emptySlots={emptySlots} />
            </>
          ) : (
            <p className="muted" style={{ marginTop: 0 }}>
              {row.tanks?.name ?? "This tank"} doesn&apos;t have a grid yet.{" "}
              <a href={`/tank/${row.tank_id}`}>Set one up</a>.
            </p>
          )
        ) : (
          <p className="muted" style={{ marginTop: 0 }}>
            This specimen isn&apos;t assigned to a tank.
          </p>
        )}
      </div>

      <h2>Edit</h2>
      <div className="card">
        <EditSpecimenForm
          specimenId={row.id}
          userId={user.id}
          initialName={row.name}
          initialAcquiredOn={row.acquired_on}
          initialRepresentativePhotoId={row.representative_photo_id}
          photos={photos.map((p) => ({ id: p.id, url: p.url, uploader_user_id: p.uploader_user_id }))}
        />
      </div>
    </div>
  );
}
