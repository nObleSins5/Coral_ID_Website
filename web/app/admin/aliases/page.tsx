import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsernamesFor } from "@/lib/wiki";
import { AliasModerationRow, type PendingAlias } from "@/components/alias-moderation-row";

type AliasRow = {
  id: string;
  alias_name: string;
  proposed_by_user_id: string | null;
  created_at: string;
  taxon_nodes: { name: string; slug: string; parent_id: string | null } | null;
};

// Admin / Moderation queue (spec §6) for coral_aliases proposals — these
// accumulate with moderation_status_code = 'proposed' from the /identify
// flow's alias-claim path and were previously never reviewed by anyone.
// Gated on users.is_moderator (sql/supabase/14_alias_moderation.sql), not
// account_type_code — a moderator can be a hobbyist or business account.
export const dynamic = "force-dynamic";

export default async function AliasModerationPage() {
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
        <h1>Alias moderation</h1>
        <p className="muted">
          This page is only available to moderators. Go back to{" "}
          <a href="/dashboard">your tanks</a>.
        </p>
      </div>
    );
  }

  const { data: aliases } = await supabase
    .from("coral_aliases")
    .select("id, alias_name, proposed_by_user_id, created_at, taxon_nodes ( name, slug, parent_id )")
    .eq("moderation_status_code", "proposed")
    .order("created_at", { ascending: true });
  const aliasRows = (aliases ?? []) as unknown as AliasRow[];

  const genusIds = [
    ...new Set(
      aliasRows.map((a) => a.taxon_nodes?.parent_id).filter((x): x is string => !!x),
    ),
  ];
  const { data: genera } =
    genusIds.length > 0
      ? await supabase.from("taxon_nodes").select("id, slug").in("id", genusIds)
      : { data: [] as { id: string; slug: string }[] };
  const genusSlugById = new Map((genera ?? []).map((g) => [g.id, g.slug]));

  const usernameById = await getUsernamesFor(
    aliasRows.map((a) => a.proposed_by_user_id).filter((x): x is string => !!x),
  );

  const pending: PendingAlias[] = aliasRows.map((a) => {
    const taxon = a.taxon_nodes;
    const genusSlug = taxon?.parent_id ? genusSlugById.get(taxon.parent_id) ?? null : null;
    return {
      aliasId: a.id,
      aliasName: a.alias_name,
      morphName: taxon?.name ?? "Unknown morph",
      morphHref: genusSlug && taxon ? `/coral/${genusSlug}/${taxon.slug}` : null,
      proposedByUsername: a.proposed_by_user_id
        ? usernameById.get(a.proposed_by_user_id) ?? "unknown"
        : "unknown",
      createdAt: a.created_at,
    };
  });

  return (
    <div>
      <h1>Alias moderation</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Alternate names the community has proposed for existing wiki entries.
        Approving makes the alias publicly searchable on that morph&apos;s page.
      </p>

      {pending.length === 0 ? (
        <p className="muted">No pending alias proposals.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="business-photo-table">
            <thead>
              <tr>
                <th>Proposed alias</th>
                <th>For coral</th>
                <th>Proposed by</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((alias) => (
                <AliasModerationRow key={alias.aliasId} alias={alias} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
