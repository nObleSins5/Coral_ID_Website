import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BusinessListingRow, type BusinessListing } from "@/components/business-listing-row";

type Row = {
  id: string;
  vendor_name: string;
  url: string;
  link_type: string;
  is_active: boolean;
  for_sale_or_trade: boolean;
  price: number | null;
  hidden_by_owner: boolean;
  coral_photos: {
    url: string;
    taxon_nodes: { name: string; slug: string; parent_id: string | null } | null;
  } | null;
};

// A business account's managed view of every affiliate link it has
// submitted — for-sale/price/hide controls in one place, rather than having
// to visit each morph page's photo individually. Business-tier only (see
// sql/supabase/12_business_listings.sql); hobbyist-to-hobbyist trade
// flagging is a separate, not-yet-built feature.
export default async function BusinessDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("account_type_code")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.account_type_code !== "business") {
    return (
      <div>
        <h1>Business dashboard</h1>
        <p className="muted">
          This dashboard is only available to business accounts. Your account
          is a hobbyist account — go back to{" "}
          <a href="/dashboard">your tanks</a>.
        </p>
      </div>
    );
  }

  const { data: listings } = await supabase
    .from("affiliate_links")
    .select(
      "id, vendor_name, url, link_type, is_active, for_sale_or_trade, price, hidden_by_owner, coral_photos!inner(url, uploader_user_id, taxon_nodes(name, slug, parent_id))",
    )
    .eq("coral_photos.uploader_user_id", user.id)
    .order("created_at", { ascending: false });
  const rows = (listings ?? []) as unknown as Row[];

  const genusIds = [
    ...new Set(
      rows.map((r) => r.coral_photos?.taxon_nodes?.parent_id).filter((x): x is string => !!x),
    ),
  ];
  const { data: genera } =
    genusIds.length > 0
      ? await supabase.from("taxon_nodes").select("id, slug").in("id", genusIds)
      : { data: [] as { id: string; slug: string }[] };
  const genusSlugById = new Map((genera ?? []).map((g) => [g.id, g.slug]));

  const business: BusinessListing[] = rows.map((r) => {
    const taxon = r.coral_photos?.taxon_nodes ?? null;
    const genusSlug = taxon?.parent_id ? genusSlugById.get(taxon.parent_id) : null;
    return {
      id: r.id,
      vendor_name: r.vendor_name,
      url: r.url,
      link_type: r.link_type,
      is_active: r.is_active,
      for_sale_or_trade: r.for_sale_or_trade,
      price: r.price,
      hidden_by_owner: r.hidden_by_owner,
      photoUrl: r.coral_photos?.url ?? "",
      morphName: taxon?.name ?? "Unknown morph",
      morphHref: genusSlug && taxon ? `/coral/${genusSlug}/${taxon.slug}` : null,
    };
  });

  return (
    <div>
      <h1>Business dashboard</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Every affiliate link you&apos;ve submitted, in one place. Add new
        links from a photo&apos;s card on that morph&apos;s wiki page.
      </p>

      {business.length === 0 ? (
        <p className="muted">
          No submissions yet — add a link from any of your photos&apos; cards
          on the coral wiki.
        </p>
      ) : (
        business.map((listing) => <BusinessListingRow key={listing.id} listing={listing} />)
      )}
    </div>
  );
}
