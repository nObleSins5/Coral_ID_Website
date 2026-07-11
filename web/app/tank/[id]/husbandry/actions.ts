"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveOrCreateProduct } from "@/lib/husbandry";

const DOSING_ELEMENTS = new Set(["alkalinity", "calcium", "magnesium"]);
const DOSING_METHODS = new Set([
  "two_part",
  "balling",
  "kalkwasser",
  "calcium_reactor",
  "dosed_supplement",
  "water_change_only",
  "other",
]);
const LEVEL_KEYS = ["low", "med", "high"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOwnedTank(supabase: any, tankId: string, userId: string) {
  const { data } = await supabase
    .from("tanks")
    .select("id")
    .eq("id", tankId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

function readProduct(formData: FormData) {
  return {
    productId: String(formData.get("product_id") ?? "") || null,
    newBrand: String(formData.get("new_brand") ?? "").trim() || null,
    newProductName: String(formData.get("new_product_name") ?? "").trim() || null,
    newCategoryCode: String(formData.get("new_category_code") ?? "") || null,
  };
}

// -----------------------------------------------------------------------
// Equipment — a light/flow item optionally gets Low/Med/High % reference
// points (equipment_levels) set at add-time; every add/level-change/remove
// is logged as a timestamped equipment_events row so it can later overlay on
// the parameter/coloration timeline (docs/future-considerations.md, "Idea 2").
// -----------------------------------------------------------------------

export async function addEquipment(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const equipmentTypeCode = String(formData.get("equipment_type_code") ?? "");
  const brand = String(formData.get("brand") ?? "").trim() || null;
  const model = String(formData.get("model") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim() || null;
  const installedOnRaw = String(formData.get("installed_on") ?? "");
  if (!equipmentTypeCode) return { error: "Choose an equipment type." };

  const tank = await getOwnedTank(supabase, tankId, user.id);
  if (!tank) return { error: "Tank not found." };

  const installedOn = installedOnRaw || new Date().toISOString().slice(0, 10);

  const { data: equipment, error: equipmentError } = await supabase
    .from("equipment")
    .insert({
      tank_id: tankId,
      equipment_type_code: equipmentTypeCode,
      brand,
      model,
      name,
      installed_on: installedOn,
    })
    .select("id")
    .single();
  if (equipmentError || !equipment) {
    return { error: equipmentError?.message ?? "Could not add equipment." };
  }

  // Only light/flow gear gets Low/Med/High reference percents (schema
  // comment on equipment_levels) — any filled-in percent becomes a row.
  if (equipmentTypeCode === "light" || equipmentTypeCode === "flow") {
    const levelRows = LEVEL_KEYS.map((level) => ({
      level,
      percent: formData.get(`level_${level}_percent`),
    }))
      .filter((r) => r.percent !== null && String(r.percent).trim() !== "")
      .map((r) => ({
        equipment_id: equipment.id,
        level: r.level,
        percent: Number(r.percent),
      }));
    if (levelRows.length > 0) {
      await supabase.from("equipment_levels").insert(levelRows);
    }
  }

  await supabase.from("equipment_events").insert({
    equipment_id: equipment.id,
    event_type: "installed",
    occurred_at: new Date(`${installedOn}T00:00:00`).toISOString(),
  });

  revalidatePath(`/tank/${tankId}/husbandry`);
  return {};
}

// Logs which reference level (low/med/high) the equipment is running at,
// right now — the actual "how strong is the user running lights/flow" signal.
export async function logEquipmentLevelChange(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const equipmentId = String(formData.get("equipment_id") ?? "");
  const level = String(formData.get("level") ?? "");
  if (!equipmentId || !LEVEL_KEYS.includes(level as (typeof LEVEL_KEYS)[number])) {
    return { error: "Invalid level." };
  }

  const tank = await getOwnedTank(supabase, tankId, user.id);
  if (!tank) return { error: "Tank not found." };

  const { data: levelRow } = await supabase
    .from("equipment_levels")
    .select("id")
    .eq("equipment_id", equipmentId)
    .eq("level", level)
    .maybeSingle();
  if (!levelRow) return { error: "That level hasn't been set up for this equipment." };

  const { error } = await supabase.from("equipment_events").insert({
    equipment_id: equipmentId,
    event_type: "level_change",
    level_id: levelRow.id,
  });
  if (error) return { error: error.message };

  revalidatePath(`/tank/${tankId}/husbandry`);
  return {};
}

export async function removeEquipment(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const equipmentId = String(formData.get("equipment_id") ?? "");
  const tank = await getOwnedTank(supabase, tankId, user.id);
  if (!tank) return { error: "Tank not found." };

  const { error } = await supabase
    .from("equipment")
    .update({ removed_on: new Date().toISOString().slice(0, 10) })
    .eq("id", equipmentId)
    .eq("tank_id", tankId);
  if (error) return { error: error.message };

  await supabase.from("equipment_events").insert({
    equipment_id: equipmentId,
    event_type: "removed",
  });

  revalidatePath(`/tank/${tankId}/husbandry`);
  return {};
}

// -----------------------------------------------------------------------
// Dosing methods — how a tank maintains alk/ca/mg over time. Product is
// optional (e.g. water_change_only or calcium_reactor need no product row).
// -----------------------------------------------------------------------

export async function addDosingMethod(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const element = String(formData.get("element") ?? "");
  const method = String(formData.get("method") ?? "");
  const startedOnRaw = String(formData.get("started_on") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!DOSING_ELEMENTS.has(element)) return { error: "Choose which element this maintains." };
  if (!DOSING_METHODS.has(method)) return { error: "Choose a method." };

  const tank = await getOwnedTank(supabase, tankId, user.id);
  if (!tank) return { error: "Tank not found." };

  const { productId, newBrand, newProductName, newCategoryCode } = readProduct(formData);
  let resolvedProductId: string | null = null;
  if (productId || newBrand) {
    const resolved = await resolveOrCreateProduct(
      supabase,
      user.id,
      productId,
      newBrand,
      newProductName,
      newCategoryCode,
    );
    if (resolved.error) return { error: resolved.error };
    resolvedProductId = resolved.id;
  }

  const { error } = await supabase.from("dosing_methods").insert({
    tank_id: tankId,
    element,
    method,
    product_id: resolvedProductId,
    started_on: startedOnRaw || new Date().toISOString().slice(0, 10),
    notes,
  });
  if (error) return { error: error.message };

  revalidatePath(`/tank/${tankId}/husbandry`);
  return {};
}

export async function endDosingMethod(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const dosingMethodId = String(formData.get("dosing_method_id") ?? "");
  const tank = await getOwnedTank(supabase, tankId, user.id);
  if (!tank) return { error: "Tank not found." };

  const { error } = await supabase
    .from("dosing_methods")
    .update({ ended_on: new Date().toISOString().slice(0, 10) })
    .eq("id", dosingMethodId)
    .eq("tank_id", tankId);
  if (error) return { error: error.message };

  revalidatePath(`/tank/${tankId}/husbandry`);
  return {};
}

// -----------------------------------------------------------------------
// Tank additives — everything else in the water (aminos, coral food, trace).
// Product is REQUIRED here (schema: tank_additives.product_id NOT NULL).
// Exact dose fields (dose_amount/dose_unit/days_of_week/times_per_day) are
// designed but deliberately deferred in the UI — see schema-decisions.md §5.
// -----------------------------------------------------------------------

export async function addTankAdditive(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const startedOnRaw = String(formData.get("started_on") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const tank = await getOwnedTank(supabase, tankId, user.id);
  if (!tank) return { error: "Tank not found." };

  const { productId, newBrand, newProductName, newCategoryCode } = readProduct(formData);
  const resolved = await resolveOrCreateProduct(
    supabase,
    user.id,
    productId,
    newBrand,
    newProductName,
    newCategoryCode,
  );
  if (resolved.error) return { error: resolved.error };
  if (!resolved.id) return { error: "Pick or add a product." };

  const { error } = await supabase.from("tank_additives").insert({
    tank_id: tankId,
    product_id: resolved.id,
    started_on: startedOnRaw || new Date().toISOString().slice(0, 10),
    notes,
  });
  if (error) return { error: error.message };

  revalidatePath(`/tank/${tankId}/husbandry`);
  return {};
}

export async function endTankAdditive(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const tankAdditiveId = String(formData.get("tank_additive_id") ?? "");
  const tank = await getOwnedTank(supabase, tankId, user.id);
  if (!tank) return { error: "Tank not found." };

  const { error } = await supabase
    .from("tank_additives")
    .update({ ended_on: new Date().toISOString().slice(0, 10) })
    .eq("id", tankAdditiveId)
    .eq("tank_id", tankId);
  if (error) return { error: error.message };

  revalidatePath(`/tank/${tankId}/husbandry`);
  return {};
}
