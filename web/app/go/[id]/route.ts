import { createHash } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Outbound affiliate-link redirect: never link straight to a vendor URL from
// the page, always through here, so every click gets logged (hashed IP only,
// no raw PII — see affiliate_clicks in schema-decisions.md §10) before the
// redirect happens.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("affiliate_links")
    .select("id, url")
    .eq("id", id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  // Only ever redirect to a link we control the scheme of — the URL is
  // vendor-submitted, so re-validate it here even though it was checked at
  // submission time.
  if (!link || !/^https?:\/\//i.test(link.url)) {
    return NextResponse.redirect(new URL("/wiki", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipHash = ip ? createHash("sha256").update(ip).digest("hex") : null;

  await supabase.from("affiliate_clicks").insert({
    affiliate_link_id: link.id,
    user_id: user?.id ?? null,
    ip_hash: ipHash,
    referrer: request.headers.get("referer"),
  });

  return NextResponse.redirect(link.url);
}
