"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildGridSlots, MAX_GRID_SLOTS } from "@/lib/grid";

// Generates a tank's grid once (columns x rows x tiers). Only for tanks that
// don't have one yet — reconfiguring in place would orphan any specimens
// already placed, so this is intentionally one-shot (see schema-decisions.md
// §4: no historical/resizable slot layout in v1).
export async function configureGrid(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const columns = Number(formData.get("grid_columns") ?? 0);
  const rows = Number(formData.get("grid_rows") ?? 0);
  const tiers = Number(formData.get("tier_count") ?? 1) || 1;
  if (!tankId || columns < 1 || rows < 1) {
    return { error: "Enter at least 1 column and 1 row." };
  }
  if (columns * rows * tiers > MAX_GRID_SLOTS) {
    return { error: `That's ${columns * rows * tiers} slots — max is ${MAX_GRID_SLOTS}.` };
  }

  const { data: tank } = await supabase
    .from("tanks")
    .select("id, user_id")
    .eq("id", tankId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!tank) return { error: "Tank not found." };

  const { count } = await supabase
    .from("grid_slots")
    .select("id", { count: "exact", head: true })
    .eq("tank_id", tankId);
  if (count && count > 0) return { error: "This tank already has a grid." };

  const slots = buildGridSlots(tankId, columns, rows, tiers);
  const { error: insertError } = await supabase.from("grid_slots").insert(slots);
  if (insertError) return { error: insertError.message };

  await supabase
    .from("tanks")
    .update({ grid_columns: columns, grid_rows: rows, tier_count: tiers })
    .eq("id", tankId);

  revalidatePath(`/tank/${tankId}`);
  return {};
}

// Unwinds a configured grid entirely: unplaces every specimen (back to the
// "unplaced specimens" bucket) and deletes the slot layout, so the tank goes
// back through ConfigureGridForm. The one-shot-at-creation design (see
// configureGrid above) still holds — this is a deliberate reset, not a
// resize, and the client-side confirm warns the user before calling it.
export async function resetGrid(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const { data: tank } = await supabase
    .from("tanks")
    .select("id")
    .eq("id", tankId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!tank) return { error: "Tank not found." };

  const { error: unplaceError } = await supabase
    .from("specimens")
    .update({ grid_slot_id: null })
    .eq("tank_id", tankId);
  if (unplaceError) return { error: unplaceError.message };

  const { error: deleteError } = await supabase
    .from("grid_slots")
    .delete()
    .eq("tank_id", tankId);
  if (deleteError) return { error: deleteError.message };

  const { error: clearError } = await supabase
    .from("tanks")
    .update({ grid_columns: null, grid_rows: null })
    .eq("id", tankId);
  if (clearError) return { error: clearError.message };

  revalidatePath(`/tank/${tankId}`);
  return {};
}
