import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSearchableHusbandryProducts } from "@/lib/husbandry";
import {
  HusbandryEquipmentSection,
  type EquipmentItem,
} from "@/components/husbandry-equipment-section";
import {
  HusbandryDosingSection,
  type DosingMethodItem,
} from "@/components/husbandry-dosing-section";
import {
  HusbandryAdditiveSection,
  type TankAdditiveItem,
} from "@/components/husbandry-additive-section";

type Tank = { id: string; name: string };
type EquipmentRow = {
  id: string;
  equipment_type_code: string;
  brand: string | null;
  model: string | null;
  name: string | null;
  installed_on: string | null;
};
type LevelRow = { id: string; equipment_id: string; level: "low" | "med" | "high"; percent: number | null };
type EventRow = { equipment_id: string; level_id: string | null; occurred_at: string };
type DosingRow = {
  id: string;
  element: string;
  method: string;
  started_on: string | null;
  ended_on: string | null;
  husbandry_products: { brand: string; product_name: string } | null;
};
type AdditiveRow = {
  id: string;
  started_on: string | null;
  ended_on: string | null;
  notes: string | null;
  husbandry_products: { brand: string; product_name: string } | null;
};

// Husbandry/equipment logging — what a tank actually does to maintain its
// water and lighting/flow over time. Separate route from /tank/[id] since
// it's a heavier, less-frequent action than placing a specimen (~2 min vs.
// ~30s, per schema-decisions.md §5's logging-tier note), not something to
// squeeze onto the main grid page. See docs/future-considerations.md, "Idea
// 2" — this is the prerequisite data layer for eventually deriving
// recommended parameters from real logged conditions, not that derivation
// itself.
export default async function TankHusbandryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tankId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tank } = await supabase
    .from("tanks")
    .select("id, name")
    .eq("id", tankId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!tank) notFound();
  const tankRow = tank as Tank;

  const [
    { data: equipmentTypes },
    { data: categories },
    { data: equipment },
    { data: dosingMethods },
    { data: additives },
    products,
  ] = await Promise.all([
    supabase.from("equipment_types").select("code, label").order("label"),
    supabase.from("husbandry_categories").select("code, label").order("label"),
    supabase
      .from("equipment")
      .select("id, equipment_type_code, brand, model, name, installed_on")
      .eq("tank_id", tankId)
      .is("removed_on", null)
      .order("installed_on", { ascending: false }),
    supabase
      .from("dosing_methods")
      .select("id, element, method, started_on, ended_on, husbandry_products ( brand, product_name )")
      .eq("tank_id", tankId)
      .order("started_on", { ascending: false }),
    supabase
      .from("tank_additives")
      .select("id, started_on, ended_on, notes, husbandry_products ( brand, product_name )")
      .eq("tank_id", tankId)
      .order("started_on", { ascending: false }),
    getSearchableHusbandryProducts(user.id),
  ]);

  const equipmentList = (equipment ?? []) as EquipmentRow[];
  const equipmentIds = equipmentList.map((e) => e.id);

  const { data: levels } =
    equipmentIds.length > 0
      ? await supabase
          .from("equipment_levels")
          .select("id, equipment_id, level, percent")
          .in("equipment_id", equipmentIds)
      : { data: [] as LevelRow[] };
  const levelsByEquipment = new Map<string, LevelRow[]>();
  for (const l of (levels ?? []) as LevelRow[]) {
    const list = levelsByEquipment.get(l.equipment_id) ?? [];
    list.push(l);
    levelsByEquipment.set(l.equipment_id, list);
  }
  const levelById = new Map((levels ?? []).map((l) => [l.id, l as LevelRow]));

  // Latest level_change event per equipment = what it's currently running at.
  const { data: events } =
    equipmentIds.length > 0
      ? await supabase
          .from("equipment_events")
          .select("equipment_id, level_id, occurred_at")
          .in("equipment_id", equipmentIds)
          .eq("event_type", "level_change")
          .order("occurred_at", { ascending: false })
      : { data: [] as EventRow[] };
  const currentLevelByEquipment = new Map<string, "low" | "med" | "high">();
  for (const e of (events ?? []) as EventRow[]) {
    if (currentLevelByEquipment.has(e.equipment_id) || !e.level_id) continue;
    const level = levelById.get(e.level_id);
    if (level) currentLevelByEquipment.set(e.equipment_id, level.level);
  }

  const equipmentItems: EquipmentItem[] = equipmentList.map((e) => ({
    id: e.id,
    equipment_type_code: e.equipment_type_code,
    brand: e.brand,
    model: e.model,
    name: e.name,
    installed_on: e.installed_on,
    levels: (levelsByEquipment.get(e.id) ?? []).map((l) => ({ level: l.level, percent: l.percent })),
    currentLevel: currentLevelByEquipment.get(e.id) ?? null,
  }));

  const dosingItems: DosingMethodItem[] = ((dosingMethods ?? []) as unknown as DosingRow[]).map((d) => ({
    id: d.id,
    element: d.element,
    method: d.method,
    started_on: d.started_on,
    ended_on: d.ended_on,
    productLabel: d.husbandry_products
      ? `${d.husbandry_products.brand} ${d.husbandry_products.product_name}`
      : null,
  }));

  const additiveItems: TankAdditiveItem[] = ((additives ?? []) as unknown as AdditiveRow[]).map((a) => ({
    id: a.id,
    productLabel: a.husbandry_products
      ? `${a.husbandry_products.brand} ${a.husbandry_products.product_name}`
      : "Unknown product",
    started_on: a.started_on,
    ended_on: a.ended_on,
    notes: a.notes,
  }));

  return (
    <div>
      <p className="breadcrumb">
        <a href="/dashboard">Your tanks</a> / <a href={`/tank/${tankId}`}>{tankRow.name}</a> /{" "}
        Equipment &amp; dosing
      </p>
      <h1 style={{ marginBottom: "0.15rem" }}>Equipment &amp; dosing</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: "1.5rem" }}>
        What&apos;s running this tank, over time — light/flow strength and
        what&apos;s being dosed. This is what eventually lets recommended
        parameters be derived from real conditions instead of a seeded guess.
      </p>

      <h2>Equipment</h2>
      <HusbandryEquipmentSection
        tankId={tankId}
        equipment={equipmentItems}
        equipmentTypes={equipmentTypes ?? []}
      />

      <h2>Dosing methods</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        How this tank maintains alkalinity, calcium, and magnesium.
      </p>
      <HusbandryDosingSection
        tankId={tankId}
        methods={dosingItems}
        products={products}
        categories={categories ?? []}
      />

      <h2>Tank additives</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Everything else going into the water — amino acids, coral food, trace
        elements.
      </p>
      <HusbandryAdditiveSection
        tankId={tankId}
        additives={additiveItems}
        products={products}
        categories={categories ?? []}
      />
    </div>
  );
}
