import { createPublicClient } from "@/lib/supabase/public";
import { getUsernamesFor } from "@/lib/wiki";

// Read-only data access for the per-coral comment board
// (docs/future-considerations.md "Idea 3") — flat, post-publish, strongly
// moderated via report-threshold auto-hide + /moderate. Parallels lib/wiki.ts's
// public-read helpers.

export type CoralComment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  username: string;
};

export async function getCommentsForTaxon(taxonNodeId: string): Promise<CoralComment[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("coral_comments")
    .select("id, body, created_at, user_id")
    .eq("taxon_node_id", taxonNodeId)
    .order("created_at", { ascending: true });

  const rows = data ?? [];
  const usernames = await getUsernamesFor(rows.map((r) => r.user_id));
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    created_at: r.created_at,
    user_id: r.user_id,
    username: usernames.get(r.user_id) ?? "A hobbyist",
  }));
}
