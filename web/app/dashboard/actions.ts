"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Create a tank (spec workflow 5.1). RLS ensures the row is owned by the caller.
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

  await supabase.from("tanks").insert({
    user_id: user.id,
    name: String(formData.get("name") ?? "").trim(),
    tank_type: String(formData.get("tank_type") ?? "").trim() || null,
    volume: num("volume"),
    length: num("length"),
    width: num("width"),
    height: num("height"),
    established_on: String(formData.get("established_on") ?? "") || null,
  });

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
