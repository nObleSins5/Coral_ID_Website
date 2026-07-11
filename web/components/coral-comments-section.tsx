"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { postComment, deleteComment, reportComment } from "@/app/coral/actions";
import type { CoralComment } from "@/lib/comments";

function CommentRow({
  comment,
  genusSlug,
  morphSlug,
  isOwn,
  alreadyReported,
}: {
  comment: CoralComment;
  genusSlug: string;
  morphSlug: string;
  isOwn: boolean;
  alreadyReported: boolean;
}) {
  const router = useRouter();
  const [reported, setReported] = useState(alreadyReported);
  const [pending, startTransition] = useTransition();

  function handleReport() {
    const formData = new FormData();
    formData.set("comment_id", comment.id);
    startTransition(async () => {
      await reportComment(formData);
      setReported(true);
    });
  }

  function handleDelete() {
    const formData = new FormData();
    formData.set("comment_id", comment.id);
    formData.set("genus_slug", genusSlug);
    formData.set("morph_slug", morphSlug);
    startTransition(async () => {
      await deleteComment(formData);
      router.refresh();
    });
  }

  return (
    <div className="comment-row">
      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        <strong className="muted">{comment.username}</strong> ·{" "}
        {new Date(comment.created_at).toLocaleDateString()}
      </p>
      <p style={{ margin: "0.25rem 0" }}>{comment.body}</p>
      <div className="comment-row-actions">
        {isOwn ? (
          <button type="button" className="link-button" disabled={pending} onClick={handleDelete}>
            Delete
          </button>
        ) : (
          <button
            type="button"
            className="link-button"
            disabled={pending || reported}
            onClick={handleReport}
          >
            {reported ? "Reported" : "Report"}
          </button>
        )}
      </div>
    </div>
  );
}

function PostCommentForm({
  taxonNodeId,
  genusSlug,
  morphSlug,
}: {
  taxonNodeId: string;
  genusSlug: string;
  morphSlug: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("taxon_node_id", taxonNodeId);
    formData.set("genus_slug", genusSlug);
    formData.set("morph_slug", morphSlug);
    startTransition(async () => {
      const result = await postComment(formData);
      if (result?.error) setError(result.error);
      else {
        setBody("");
        router.refresh();
      }
    });
  }

  return (
    <form className="add-photo-form card" action={handleSubmit}>
      <label htmlFor="comment-body">Add a comment</label>
      <textarea
        id="comment-body"
        name="body"
        rows={3}
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Care tips, what changed when you adjusted flow, questions…"
      />
      <div className="form-actions">
        <button type="submit" disabled={pending || !body.trim()}>
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function CoralCommentsSection({
  taxonNodeId,
  genusSlug,
  morphSlug,
  initialComments,
}: {
  taxonNodeId: string;
  genusSlug: string;
  morphSlug: string;
  initialComments: CoralComment[];
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (user && initialComments.length > 0) {
        const { data: reports } = await supabase
          .from("coral_comment_reports")
          .select("comment_id")
          .eq("user_id", user.id)
          .in(
            "comment_id",
            initialComments.map((c) => c.id),
          );
        setReportedIds(new Set((reports ?? []).map((r) => r.comment_id)));
      }
      setLoading(false);
    })();
    // initialComments is a stable server-fetched prop for this page render;
    // intentionally not a dependency to avoid refetching on local state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {initialComments.length === 0 ? (
        <p className="muted">No comments yet — be the first to say something.</p>
      ) : (
        <div className="card">
          {initialComments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              genusSlug={genusSlug}
              morphSlug={morphSlug}
              isOwn={userId === c.user_id}
              alreadyReported={reportedIds.has(c.id)}
            />
          ))}
        </div>
      )}
      {!loading && userId ? (
        <PostCommentForm taxonNodeId={taxonNodeId} genusSlug={genusSlug} morphSlug={morphSlug} />
      ) : !loading ? (
        <p className="muted">
          <a href="/login">Log in</a> to join the discussion.
        </p>
      ) : null}
    </div>
  );
}
