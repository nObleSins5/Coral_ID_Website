"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toggleWishlist } from "@/app/coral/actions";

export function WishlistButton({
  taxonNodeId,
  genusSlug,
  morphSlug,
}: {
  taxonNodeId: string;
  genusSlug: string;
  morphSlug: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(false);
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
          .from("want_list")
          .select("id")
          .eq("user_id", user.id)
          .eq("taxon_node_id", taxonNodeId)
          .maybeSingle();
        setWishlisted(!!data);
      }
      setLoading(false);
    })();
  }, [taxonNodeId]);

  if (loading || !userId) return null;

  function handleClick() {
    const formData = new FormData();
    formData.set("taxon_node_id", taxonNodeId);
    formData.set("genus_slug", genusSlug);
    formData.set("morph_slug", morphSlug);

    const next = !wishlisted;
    setWishlisted(next);
    startTransition(async () => {
      const result = await toggleWishlist(formData);
      if (result?.error) {
        setWishlisted(!next);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      className={`wishlist-button${wishlisted ? " wishlisted" : ""}`}
      onClick={handleClick}
      disabled={pending}
      title={wishlisted ? "Remove from your wishlist" : "Add to your wishlist"}
    >
      {wishlisted ? "★ Wishlisted" : "☆ Wishlist"}
    </button>
  );
}
