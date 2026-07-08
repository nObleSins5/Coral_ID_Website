"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { reportDeadLink } from "@/app/affiliate/actions";

// Cheap, crowdsourced dead-link signal (docs/future-considerations.md idea
// 3) — enough distinct reports auto-deactivate the link server-side.
export function ReportDeadLinkButton({
  linkId,
  genusSlug,
  morphSlug,
}: {
  linkId: string;
  genusSlug: string;
  morphSlug: string;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (user) {
        const { data } = await supabase
          .from("affiliate_link_reports")
          .select("id")
          .eq("affiliate_link_id", linkId)
          .eq("user_id", user.id)
          .maybeSingle();
        setReported(!!data);
      }
    })();
  }, [linkId]);

  function handleClick() {
    if (!userId) {
      window.location.href = "/login";
      return;
    }
    setReported(true);
    const formData = new FormData();
    formData.set("affiliate_link_id", linkId);
    formData.set("genus_slug", genusSlug);
    formData.set("morph_slug", morphSlug);
    startTransition(async () => {
      await reportDeadLink(formData);
    });
  }

  return (
    <button
      type="button"
      className="btn-secondary report-dead-link-button"
      onClick={handleClick}
      disabled={pending || reported}
    >
      {reported ? "Reported" : "Report dead link"}
    </button>
  );
}
