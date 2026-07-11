import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSearchableHusbandryProducts } from "@/lib/husbandry";
import { HusbandryFlowSection, type FlowEquipmentItem } from "@/components/husbandry-flow-section";
import { HusbandryLightSection, type LightEquipmentItem } from "@/components/husbandry-light-section";
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
  flow_pattern: string | null;
  light_mode: string | null;
  peak_hours: number | null;
  wattage: number | null;
  placement: string | null;
  installed_on: string | null;
};
type LevelRow = { id: string; equipment_id: string; level: "low" | "med" | "high" };
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
// ~30s, per schema-decisions.md §5's logging-tier note). Flow and Light are
// their own dedicated sections (not one generic "equipment" type picker) per
// product feedback (2026-07-11) — see docs/future-considerations.md, "Idea
// 2" for why this logging surface is the prerequisite for eventually
// deriving recommended parameters from real conditions, not that derivation
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

  const [{ data: categories }, { data: equipment }, { data: dosingMethods }, { data: additives }, products] =
    await Promise.all([
      supabase.from("husbandry_categories").select("code, label").order("label"),
      supabase
        .from("equipment")
        .select(
          "id, equipment_type_code, brand, model, flow_pattern, light_mode, peak_hours, wattage, placement, installed_on",
        )
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
  const flowRows = equipmentList.filter((e) => e.equipment_type_code === "flow");
  const lightRows = equipmentList.filter((e) => e.equipment_type_code === "light");
  const flowIds = flowRows.map((e) => e.id);

  const { data: levels } =
    flowIds.length > 0
      ? await supabase.from("equipment_levels").select("id, equipment_id, level").in("equipment_id", flowIds)
      : { data: [] as LevelRow[] };
  const levelById = new Map(((levels ?? []) as LevelRow[]).map((l) => [l.id, l]));

  const { data: events } =
    flowIds.length > 0
      ? await supabase
          .from("equipment_events")
          .select("equipment_id, level_id, occurred_at")
          .in("equipment_id", flowIds)
          .eq("event_type", "level_change")
          .order("occurred_at", { ascending: false })
      : { data: [] as EventRow[] };
  const currentLevelByEquipment = new Map<string, "low" | "med" | "high">();
  for (const e of (events ?? []) as EventRow[]) {
    if (currentLevelByEquipment.has(e.equipment_id) || !e.level_id) continue;
    const level = levelById.get(e.level_id);
    if (level) currentLevelByEquipment.set(e.equipment_id, level.level);
  }

  const flowItems: FlowEquipmentItem[] = flowRows.map((e) => ({
    id: e.id,
    brand: e.brand,
    model: e.model,
    flow_pattern: e.flow_pattern,
    placement: e.placement,
    installed_on: e.installed_on,
    currentLevel: currentLevelByEquipment.get(e.id) ?? null,
  }));

  const lightItems: LightEquipmentItem[] = lightRows.map((e) => ({
    id: e.id,
    brand: e.brand,
    model: e.model,
    light_mode: e.light_mode,
    peak_hours: e.peak_hours,
    wattage: e.wattage,
    placement: e.placement,
    installed_on: e.installed_on,
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
        what&apos;s being dosed. Removing something never deletes its
        history — it stays linked to whenever a coral was photographed or
        confirmed while it was running.
      </p>

      <h2>Flow</h2>
      <HusbandryFlowSection tankId={tankId} equipment={flowItems} />

      <h2>Light</h2>
      <HusbandryLightSection tankId={tankId} equipment={lightItems} />

      <h2>Core-Element Dosing</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        How this tank maintains alkalinity, calcium, and magnesium.
      </p>
      <HusbandryDosingSection
        tankId={tankId}
        methods={dosingItems}
        products={products}
        categories={categories ?? []}
      />

      <h2>Trace and Other Supplementation</h2>
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
