import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Read-only data access for the husbandry/equipment logging pages
// (dosing methods, tank additives, equipment) — parallels lib/wiki.ts for the
// coral-taxonomy domain, kept separate since this is tank-regimen data, not
// wiki content.

export type SearchableProduct = {
  id: string;
  brand: string;
  product_name: string;
  category_code: string;
};

// The product picker's search list: every approved product (public catalog)
// plus the current user's own not-yet-approved proposals (so they can reuse
// a product they just proposed without waiting on moderation, and don't
// accidentally propose a near-duplicate). Uses the authenticated session
// client, not the public client, since the "own proposed" half depends on
// husbandry_products_owner_read (sql/supabase/17_husbandry_logging.sql).
export async function getSearchableHusbandryProducts(
  userId: string,
): Promise<SearchableProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("husbandry_products")
    .select("id, brand, product_name, category_code, moderation_status_code, added_by_user_id")
    .or(`moderation_status_code.eq.approved,added_by_user_id.eq.${userId}`)
    .order("brand");

  const seen = new Set<string>();
  const products: SearchableProduct[] = [];
  for (const p of data ?? []) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    products.push({
      id: p.id,
      brand: p.brand,
      product_name: p.product_name,
      category_code: p.category_code,
    });
  }
  return products;
}

// Shared by app/tank/[id]/husbandry/actions.ts's dosing-method and
// tank-additive forms: either use an existing product (picked from the
// searchable list above) or propose a brand-new one inline. A proposed
// product starts moderation_status_code = 'proposed' (DB default) — it goes
// straight into the /moderate queue, same as a coral alias — but the
// husbandry_products_owner_read policy lets the proposer see it immediately.
export async function resolveOrCreateProduct(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  productId: string | null,
  newBrand: string | null,
  newProductName: string | null,
  newCategoryCode: string | null,
): Promise<{ id: string | null; error?: string }> {
  if (productId) return { id: productId };

  if (!newBrand || !newProductName || !newCategoryCode) {
    return { id: null, error: "Pick an existing product, or fill in brand/name/category for a new one." };
  }

  const { data, error } = await supabase
    .from("husbandry_products")
    .insert({
      brand: newBrand,
      product_name: newProductName,
      category_code: newCategoryCode,
      added_by_user_id: userId,
    })
    .select("id")
    .single();
  if (error) {
    // Unique violation on (brand, product_name) — someone already proposed
    // or catalogued this exact product; point the user at searching instead
    // of failing silently.
    if (error.code === "23505") {
      return { id: null, error: "That product already exists — search for it instead of adding it again." };
    }
    return { id: null, error: error.message };
  }
  return { id: data.id };
}
