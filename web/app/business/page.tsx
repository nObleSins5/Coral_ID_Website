import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BusinessPhotoRow, type BusinessLink, type BusinessPhoto } from "@/components/business-photo-row";

type PhotoRow = {
  id: string;
  url: string;
  taxon_nodes: { name: string; slug: string; parent_id: string | null } | null;
};

type LinkRow = BusinessLink & { coral_photo_id: string };

// A business account's managed view of every photo it's posted of a
// confirmed community morph — one row per photo (not per affiliate link, so
// a photo posted but not yet listed for sale still shows up), with inline
// for-sale/price/hide controls on any existing listing, or an "add a
// listing" form when there isn't one yet. Business-tier only (see
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

  const { data: photos } = await supabase
    .from("coral_photos")
    .select("id, url, taxon_nodes ( name, slug, parent_id )")
    .eq("uploader_user_id", user.id)
    .not("taxon_node_id", "is", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const photoRows = (photos ?? []) as unknown as PhotoRow[];

  const genusIds = [
    ...new Set(
      photoRows.map((p) => p.taxon_nodes?.parent_id).filter((x): x is string => !!x),
    ),
  ];
  const { data: genera } =
    genusIds.length > 0
      ? await supabase.from("taxon_nodes").select("id, slug").in("id", genusIds)
      : { data: [] as { id: string; slug: string }[] };
  const genusSlugById = new Map((genera ?? []).map((g) => [g.id, g.slug]));

  const photoIds = photoRows.map((p) => p.id);
  const { data: links } =
    photoIds.length > 0
      ? await supabase
          .from("affiliate_links")
          .select(
            "id, vendor_name, url, link_type, is_active, for_sale_or_trade, price, hidden_by_owner, coral_photo_id",
          )
          .in("coral_photo_id", photoIds)
          .order("created_at", { ascending: false })
      : { data: [] as LinkRow[] };
  const linksByPhoto = new Map<string, LinkRow[]>();
  for (const l of (links ?? []) as LinkRow[]) {
    const list = linksByPhoto.get(l.coral_photo_id) ?? [];
    list.push(l);
    linksByPhoto.set(l.coral_photo_id, list);
  }

  const businessPhotos: BusinessPhoto[] = photoRows.map((p) => {
    const taxon = p.taxon_nodes;
    const genusSlug = taxon?.parent_id ? genusSlugById.get(taxon.parent_id) ?? null : null;
    return {
      photoId: p.id,
      photoUrl: p.url,
      morphName: taxon?.name ?? "Unknown morph",
      morphHref: genusSlug && taxon ? `/coral/${genusSlug}/${taxon.slug}` : null,
      genusSlug,
      morphSlug: taxon?.slug ?? null,
      links: linksByPhoto.get(p.id) ?? [],
    };
  });

  return (
    <div>
      <h1>Business dashboard</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Every photo you&apos;ve posted of a confirmed coral, in one place —
        list it for sale/trade, set a price, or hide it, without hunting
        through the wiki.
      </p>

      {businessPhotos.length === 0 ? (
        <p className="muted">
          No photos yet — post one from any coral&apos;s wiki page to get
          started.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="business-photo-table">
            <thead>
              <tr>
                <th>Coral</th>
                <th>Photo</th>
                <th>Listing</th>
              </tr>
            </thead>
            <tbody>
              {businessPhotos.map((photo) => (
                <BusinessPhotoRow key={photo.photoId} photo={photo} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
