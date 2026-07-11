import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";

// Data access for community-contributed element color samples
// (element_color_samples). The wiki shows only CONFIRMED samples; the
// range-check helper gathers an element's documented colors (seed color stops
// + already-confirmed samples) so a new submission can be scored against
// consensus. See web/lib/color.ts for the ΔE math.

// Confirmed community samples for a taxon, grouped by element_type_code.
// Used by the element color key to show community-verified colors alongside
// (or in place of) the seed range.
export async function getConfirmedColorSamples(
  taxonNodeId: string,
): Promise<Map<string, string[]>> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("element_color_samples")
    .select("element_type_code, used_hex")
    .eq("taxon_node_id", taxonNodeId)
    .eq("status", "confirmed");
  const map = new Map<string, string[]>();
  for (const r of data ?? []) {
    const list = map.get(r.element_type_code) ?? [];
    list.push(r.used_hex);
    map.set(r.element_type_code, list);
  }
  return map;
}

// The documented reference colors for one element on one taxon: the union of
// its seed color stops and its already-confirmed community samples. The
// range-check scores a new sample's minimum ΔE against this set — so as real
// confirmed data accrues, consensus reinforces itself. Empty when the element
// has no documented color yet (a brand-new element), which the caller treats
// as "can't auto-confirm — needs review."
export async function getElementReferenceHexes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  taxonNodeId: string,
  elementCode: string,
): Promise<string[]> {
  const hexes: string[] = [];

  const { data: profile } = await supabase
    .from("element_profiles")
    .select("color_ranges ( color_stops ( hex ) )")
    .eq("taxon_node_id", taxonNodeId)
    .eq("element_type_code", elementCode)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ranges = ((profile as any)?.color_ranges ?? []) as any[];
  for (const range of ranges) {
    for (const stop of range.color_stops ?? []) {
      if (stop.hex) hexes.push(stop.hex);
    }
  }

  const { data: samples } = await supabase
    .from("element_color_samples")
    .select("used_hex")
    .eq("taxon_node_id", taxonNodeId)
    .eq("element_type_code", elementCode)
    .eq("status", "confirmed");
  for (const s of samples ?? []) hexes.push(s.used_hex);

  return hexes;
}
