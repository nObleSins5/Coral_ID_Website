import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsernamesFor, getAllMorphsForSearch, getColorLabelSuggestions } from "@/lib/wiki";
import {
  AliasModerationRow,
  ProductModerationRow,
  CommentModerationRow,
  MorphProposalModerationRow,
} from "@/components/moderation-row";
import { ColorModeration } from "@/components/color-moderation";

type AliasRow = {
  id: string;
  alias_name: string;
  proposed_by_user_id: string | null;
  created_at: string;
  taxon_nodes: { name: string; slug: string; parent_id: string | null; rank_code: string } | null;
};

type MorphProposalRow = {
  id: string;
  proposed_name: string | null;
  net_votes: number;
  created_at: string;
  suggested_by_user_id: string;
  coral_photos: { url: string } | null;
  taxon_nodes: { name: string; slug: string } | null; // the target genus, via proposed_genus_id
};

type ProductRow = {
  id: string;
  brand: string;
  product_name: string;
  category_code: string;
  added_by_user_id: string | null;
  created_at: string;
};

type CommentRow = {
  id: string;
  body: string;
  user_id: string;
  created_at: string;
  taxon_nodes: { name: string; slug: string; parent_id: string | null; rank_code: string } | null;
};

// Moderator-only review queue for the two catalogs that accumulate
// community-proposed rows nothing ever reviewed before: coral_aliases (trade
// names attached to a wiki entry) and husbandry_products (dosing/supplement
// catalog). is_moderator is a boolean on users, independent of
// account_type_code — see sql/supabase/14_alias_moderation.sql for why.
export default async function ModerateQueue() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("is_moderator")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_moderator) {
    return (
      <div>
        <h1>Moderation queue</h1>
        <p className="muted">
          This page is only available to moderators — go back to{" "}
          <a href="/dashboard">your tanks</a>.
        </p>
      </div>
    );
  }

  const { data: aliases } = await supabase
    .from("coral_aliases")
    .select(
      "id, alias_name, proposed_by_user_id, created_at, taxon_nodes ( name, slug, parent_id, rank_code )",
    )
    .eq("moderation_status_code", "proposed")
    .order("created_at", { ascending: true });
  const aliasRows = (aliases ?? []) as unknown as AliasRow[];

  const { data: comments } = await supabase
    .from("coral_comments")
    .select("id, body, user_id, created_at, taxon_nodes ( name, slug, parent_id, rank_code )")
    .eq("is_hidden", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  const commentRows = (comments ?? []) as unknown as CommentRow[];

  const commentIds = commentRows.map((c) => c.id);
  const { data: reports } =
    commentIds.length > 0
      ? await supabase.from("coral_comment_reports").select("comment_id").in("comment_id", commentIds)
      : { data: [] as { comment_id: string }[] };
  const reportCountByComment = new Map<string, number>();
  for (const r of reports ?? []) {
    reportCountByComment.set(r.comment_id, (reportCountByComment.get(r.comment_id) ?? 0) + 1);
  }

  const genusIds = [
    ...new Set(
      [...aliasRows, ...commentRows]
        .map((a) => (a.taxon_nodes?.rank_code === "morph" ? a.taxon_nodes.parent_id : null))
        .filter((x): x is string => !!x),
    ),
  ];
  const { data: genera } =
    genusIds.length > 0
      ? await supabase.from("taxon_nodes").select("id, name, slug").in("id", genusIds)
      : { data: [] as { id: string; name: string; slug: string }[] };
  const genusById = new Map((genera ?? []).map((g) => [g.id, g]));

  const { data: products } = await supabase
    .from("husbandry_products")
    .select("id, brand, product_name, category_code, added_by_user_id, created_at")
    .eq("moderation_status_code", "proposed")
    .order("created_at", { ascending: true });
  const productRows = (products ?? []) as ProductRow[];

  const { data: categories } = await supabase
    .from("husbandry_categories")
    .select("code, label");
  const categoryLabelByCode = new Map((categories ?? []).map((c) => [c.code, c.label]));

  // Brand-new-morph proposals still pending — a proposal targeting an
  // existing taxon (proposed_taxon_id set) doesn't need this queue, it's
  // just a photo waiting on votes for an ALREADY-real coral. This only
  // covers the "propose a coral that doesn't exist yet" case (same set
  // getPendingMorphsForGenus, lib/wiki.ts, shows per-genus on the wiki page).
  const { data: morphProposals } = await supabase
    .from("id_suggestions")
    .select(
      "id, proposed_name, net_votes, created_at, suggested_by_user_id, coral_photos ( url ), taxon_nodes!fk_id_suggestions_genus ( name, slug )",
    )
    .eq("status_code", "pending")
    .is("proposed_taxon_id", null)
    .not("proposed_genus_id", "is", null)
    .order("net_votes", { ascending: false });
  const morphProposalRows = (morphProposals ?? []) as unknown as MorphProposalRow[];

  const [morphs, { data: elementTypes }, labelSuggestions, { data: coloredTaxonIds }] = await Promise.all([
    getAllMorphsForSearch(),
    supabase.from("element_types").select("code, label").order("code"),
    getColorLabelSuggestions(),
    supabase.from("color_ranges").select("taxon_node_id"),
  ]);
  // Status indicator for the "Coral colors" section below — how many morphs
  // have zero color_ranges yet, including ones just confirmed above (auto or
  // manual). No new schema/flag needed: a taxon with no color_ranges row IS
  // "needs a first profile", whether it's brand new or an old seeded gap.
  const coloredTaxonIdSet = new Set((coloredTaxonIds ?? []).map((r) => r.taxon_node_id));
  const needsColorCount = morphs.filter((m) => !coloredTaxonIdSet.has(m.id)).length;

  const usernames = await getUsernamesFor(
    [
      ...aliasRows.map((a) => a.proposed_by_user_id),
      ...productRows.map((p) => p.added_by_user_id),
      ...commentRows.map((c) => c.user_id),
      ...morphProposalRows.map((m) => m.suggested_by_user_id),
    ].filter((x): x is string => !!x),
  );

  return (
    <div>
      <h1>Moderation queue</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Review community-proposed trade names and husbandry products before
        they go public.
      </p>

      <h2>Pending morphs</h2>
      {morphProposalRows.length === 0 ? (
        <p className="muted">No morph proposals pending review.</p>
      ) : (
        <div className="card">
          {morphProposalRows.map((m) => (
            <MorphProposalModerationRow
              key={m.id}
              suggestionId={m.id}
              proposedName={m.proposed_name ?? "Untitled"}
              genusName={m.taxon_nodes?.name ?? "Unknown genus"}
              genusSlug={m.taxon_nodes?.slug ?? null}
              photoUrl={m.coral_photos?.url ?? null}
              proposedBy={usernames.get(m.suggested_by_user_id) ?? "A hobbyist"}
              netVotes={m.net_votes}
              createdAt={m.created_at}
            />
          ))}
        </div>
      )}

      <h2>
        Coral colors{" "}
        {needsColorCount > 0 ? (
          <span className="pill pill-pending">{needsColorCount} need a first profile</span>
        ) : null}
      </h2>
      <ColorModeration morphs={morphs} elementTypes={elementTypes ?? []} labelSuggestions={labelSuggestions} />

      <h2>Coral aliases</h2>
      {aliasRows.length === 0 ? (
        <p className="muted">No aliases pending review.</p>
      ) : (
        <div className="card">
          {aliasRows.map((a) => {
            const taxon = a.taxon_nodes;
            const genus =
              taxon?.rank_code === "morph" && taxon.parent_id
                ? genusById.get(taxon.parent_id)
                : null;
            const taxonHref = genus && taxon ? `/coral/${genus.slug}/${taxon.slug}` : null;
            return (
              <AliasModerationRow
                key={a.id}
                aliasId={a.id}
                aliasName={a.alias_name}
                taxonName={taxon?.name ?? "Unknown entry"}
                genusName={genus?.name ?? null}
                taxonHref={taxonHref}
                proposedBy={
                  a.proposed_by_user_id
                    ? usernames.get(a.proposed_by_user_id) ?? "A hobbyist"
                    : "A hobbyist"
                }
                createdAt={a.created_at}
              />
            );
          })}
        </div>
      )}

      <h2>Husbandry products</h2>
      {productRows.length === 0 ? (
        <p className="muted">No products pending review.</p>
      ) : (
        <div className="card">
          {productRows.map((p) => (
            <ProductModerationRow
              key={p.id}
              productId={p.id}
              brand={p.brand}
              productName={p.product_name}
              categoryLabel={categoryLabelByCode.get(p.category_code) ?? p.category_code}
              addedBy={
                p.added_by_user_id
                  ? usernames.get(p.added_by_user_id) ?? "A hobbyist"
                  : "A hobbyist"
              }
              createdAt={p.created_at}
            />
          ))}
        </div>
      )}

      <h2>Reported comments</h2>
      {commentRows.length === 0 ? (
        <p className="muted">No reported comments right now.</p>
      ) : (
        <div className="card">
          {commentRows.map((c) => {
            const taxon = c.taxon_nodes;
            const genus =
              taxon?.rank_code === "morph" && taxon.parent_id
                ? genusById.get(taxon.parent_id)
                : null;
            const taxonHref = genus && taxon ? `/coral/${genus.slug}/${taxon.slug}` : null;
            return (
              <CommentModerationRow
                key={c.id}
                commentId={c.id}
                body={c.body}
                taxonName={taxon ? `${taxon.name}${genus ? ` (${genus.name})` : ""}` : "Unknown entry"}
                taxonHref={taxonHref}
                authorUsername={usernames.get(c.user_id) ?? "A hobbyist"}
                reportCount={reportCountByComment.get(c.id) ?? 0}
                createdAt={c.created_at}
              />
            );
          })}
        </div>
      )}

    </div>
  );
}
