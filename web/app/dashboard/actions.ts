"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildGridSlots, MAX_GRID_SLOTS } from "@/lib/grid";

// Create a tank (spec workflow 5.1). RLS ensures the row is owned by the caller.
// Grid columns/rows/tiers are optional at this step — a tank with no layout
// yet can be configured later from its /tank/[id] page (configureGrid).
export async function createTank(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : Number(v);
  };

  const columns = num("grid_columns");
  const rows = num("grid_rows");
  const tiers = num("tier_count") ?? 1;

  const { data: tank, error } = await supabase
    .from("tanks")
    .insert({
      user_id: user.id,
      name: String(formData.get("name") ?? "").trim(),
      tank_type: String(formData.get("tank_type") ?? "").trim() || null,
      volume: num("volume"),
      length: num("length"),
      width: num("width"),
      height: num("height"),
      established_on: String(formData.get("established_on") ?? "") || null,
      tier_count: tiers,
      grid_columns: columns && columns > 0 ? columns : null,
      grid_rows: rows && rows > 0 ? rows : null,
    })
    .select("id")
    .single();

  if (!error && tank && columns && rows && columns > 0 && rows > 0) {
    const slots = buildGridSlots(tank.id, columns, rows, tiers);
    if (slots.length <= MAX_GRID_SLOTS) {
      await supabase.from("grid_slots").insert(slots);
    }
  }

  revalidatePath("/dashboard");
}

// Log one parameter reading (spec workflow — the core five, pure/append-only).
export async function logParameters(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : Number(v);
  };

  await supabase.from("parameter_readings").insert({
    tank_id: String(formData.get("tank_id")),
    measured_at: new Date().toISOString(),
    alkalinity_dkh: num("alkalinity_dkh"),
    calcium_ppm: num("calcium_ppm"),
    magnesium_ppm: num("magnesium_ppm"),
    nitrate_ppm: num("nitrate_ppm"),
    phosphate_ppm: num("phosphate_ppm"),
  });

  revalidatePath("/dashboard");
}

// Removes one entry from the current user's wishlist. RLS (want_list_owner_all)
// already restricts deletes to the caller's own rows.
export async function removeFromWishlist(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("want_list")
    .delete()
    .eq("id", String(formData.get("want_list_id") ?? ""))
    .eq("user_id", user.id);

  revalidatePath("/dashboard");
}
