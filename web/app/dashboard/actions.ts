"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

  // Every successful creation lands the user straight in the new tank —
  // consistent for a first tank or a fifth, and it's exactly where they'd
  // click next anyway (docs/onboard-first-coral-journey-brief.md).
  // redirect() throws, so nothing after this line runs on success.
  if (!error && tank) redirect(`/tank/${tank.id}`);
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

// Deletes a tank. grid_slots/parameter_readings/equipment/tank_map_tiles
// etc. all cascade off tanks(id) ON DELETE CASCADE, but specimens.tank_id
// (and coral_photos.tank_id) deliberately do NOT — a coral's identification
// history and community photos are meant to outlive a tank's own record.
// Rather than choosing on the owner's behalf whether to orphan or drag
// those along, this refuses to delete a tank that still has corals in it
// and asks the owner to move/remove them first — same
// safety-over-convenience stance as the grid reset warning on /tank/[id]
// ("moves every coral out of its slot, so it's not something to do
// casually").
export async function deleteTank(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const { data: tank } = await supabase.from("tanks").select("id").eq("id", tankId).eq("user_id", user.id).maybeSingle();
  if (!tank) return { error: "Tank not found." };

  const { count } = await supabase
    .from("specimens")
    .select("id", { count: "exact", head: true })
    .eq("tank_id", tankId);
  if (count) {
    return { error: `This tank still has ${count} coral${count === 1 ? "" : "s"} in it — move or remove them first.` };
  }

  const { error } = await supabase.from("tanks").delete().eq("id", tankId).eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return {};
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
