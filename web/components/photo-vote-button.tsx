"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toggleAccurateVote } from "@/app/coral/actions";

// Label is deliberately explicit ("Confirm this is X"), not a generic
// like/heart icon — the whole point is that a vote means "correct match",
// not "pretty photo" (see docs/future-considerations.md).
export function PhotoVoteButton({
  photoId,
  initialCount,
  morphName,
  genusSlug,
  morphSlug,
}: {
  photoId: string;
  initialCount: number;
  morphName: string;
  genusSlug: string;
  morphSlug: string;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [count, setCount] = useState(initialCount);
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
          .from("coral_photo_votes")
          .select("id")
          .eq("coral_photo_id", photoId)
          .eq("user_id", user.id)
          .eq("vote_type", "accurate")
          .maybeSingle();
        setVoted(!!data);
      }
    })();
  }, [photoId]);

  function handleClick() {
    if (!userId) {
      router.push("/login");
      return;
    }
    const formData = new FormData();
    formData.set("photo_id", photoId);
    formData.set("genus_slug", genusSlug);
    formData.set("morph_slug", morphSlug);

    // Optimistic update.
    const nextVoted = !voted;
    setVoted(nextVoted);
    setCount((c) => c + (nextVoted ? 1 : -1));

    startTransition(async () => {
      const result = await toggleAccurateVote(formData);
      if (result?.error) {
        // Revert on failure.
        setVoted(voted);
        setCount((c) => c + (nextVoted ? -1 : 1));
      } else {
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      className={`vote-button${voted ? " voted" : ""}`}
      onClick={handleClick}
      disabled={pending}
      title={`Vote if this photo is an accurate, representative ${morphName}`}
    >
      ✓ Confirm match {count > 0 ? `(${count})` : ""}
    </button>
  );
}
