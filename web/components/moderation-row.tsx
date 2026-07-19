"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  moderateAlias,
  moderateProduct,
  restoreComment,
  deleteReportedComment,
  confirmMorphProposal,
} from "@/app/moderate/actions";

// One pending row + Approve/Reject — same optimistic-remove-on-success shape
// as the rest of the app's inline moderation-ish actions (reset-grid-button,
// business-photo-row): call the action, then router.refresh() so the row
// drops out once its status is no longer 'proposed'.
function useDecision(
  action: (formData: FormData) => Promise<{ error?: string }>,
  idField: string,
  id: string,
) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(decision: "approved" | "rejected") {
    setError(null);
    const formData = new FormData();
    formData.set(idField, id);
    formData.set("decision", decision);
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return { decide, pending, error };
}

export function AliasModerationRow({
  aliasId,
  aliasName,
  taxonName,
  genusName,
  taxonHref,
  proposedBy,
  createdAt,
}: {
  aliasId: string;
  aliasName: string;
  taxonName: string;
  genusName: string | null;
  taxonHref: string | null;
  proposedBy: string;
  createdAt: string;
}) {
  const { decide, pending, error } = useDecision(moderateAlias, "alias_id", aliasId);

  return (
    <div className="moderation-row">
      <div>
        <p style={{ margin: 0 }}>
          <strong>&quot;{aliasName}&quot;</strong> for{" "}
          {taxonHref ? (
            <a href={taxonHref}>
              {taxonName}
              {genusName ? ` (${genusName})` : ""}
            </a>
          ) : (
            <>
              {taxonName}
              {genusName ? ` (${genusName})` : ""}
            </>
          )}
        </p>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          Proposed by {proposedBy} · {new Date(createdAt).toLocaleDateString()}
        </p>
        {error ? <p className="error">{error}</p> : null}
      </div>
      <div className="moderation-actions">
        <button type="button" disabled={pending} onClick={() => decide("approved")}>
          Approve
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={pending}
          onClick={() => decide("rejected")}
        >
          Reject
        </button>
      </div>
    </div>
  );
}

export function CommentModerationRow({
  commentId,
  body,
  taxonName,
  taxonHref,
  authorUsername,
  reportCount,
  createdAt,
}: {
  commentId: string;
  body: string;
  taxonName: string;
  taxonHref: string | null;
  authorUsername: string;
  reportCount: number;
  createdAt: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function act(action: (formData: FormData) => Promise<{ error?: string }>) {
    setError(null);
    const formData = new FormData();
    formData.set("comment_id", commentId);
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="moderation-row">
      <div>
        <p style={{ margin: 0 }}>
          On {taxonHref ? <a href={taxonHref}>{taxonName}</a> : taxonName} — by{" "}
          <strong>{authorUsername}</strong>{" "}
          <span className="pill">
            {reportCount} report{reportCount === 1 ? "" : "s"}
          </span>
        </p>
        <p className="muted" style={{ margin: "0.25rem 0" }}>
          &quot;{body}&quot;
        </p>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          {new Date(createdAt).toLocaleDateString()}
        </p>
        {error ? <p className="error">{error}</p> : null}
      </div>
      <div className="moderation-actions">
        <button type="button" disabled={pending} onClick={() => act(restoreComment)}>
          Restore
        </button>
        <button
          type="button"
          className="btn-danger"
          disabled={pending}
          onClick={() => act(deleteReportedComment)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function ProductModerationRow({
  productId,
  brand,
  productName,
  categoryLabel,
  addedBy,
  createdAt,
}: {
  productId: string;
  brand: string;
  productName: string;
  categoryLabel: string;
  addedBy: string;
  createdAt: string;
}) {
  const { decide, pending, error } = useDecision(moderateProduct, "product_id", productId);

  return (
    <div className="moderation-row">
      <div>
        <p style={{ margin: 0 }}>
          <strong>
            {brand} {productName}
          </strong>{" "}
          <span className="pill">{categoryLabel}</span>
        </p>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          Added by {addedBy} · {new Date(createdAt).toLocaleDateString()}
        </p>
        {error ? <p className="error">{error}</p> : null}
      </div>
      <div className="moderation-actions">
        <button type="button" disabled={pending} onClick={() => decide("approved")}>
          Approve
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={pending}
          onClick={() => decide("rejected")}
        >
          Reject
        </button>
      </div>
    </div>
  );
}

// Brand-new-morph proposal, not yet cleared for auto-confirm
// (handle_id_vote_change, sql/supabase/09_unidentified_id_flow.sql). "Confirm
// now" is a moderator fast-path to the exact same outcome the vote trigger
// would eventually produce (moderator_confirm_suggestion,
// sql/supabase/33_moderator_confirm_suggestion.sql) — a single action, no
// reject button: a bad proposal is already handled by downvotes through the
// normal vote flow, this queue is only for accelerating good ones.
export function MorphProposalModerationRow({
  suggestionId,
  proposedName,
  genusName,
  genusSlug,
  photoUrl,
  proposedBy,
  netVotes,
  createdAt,
}: {
  suggestionId: string;
  proposedName: string;
  genusName: string;
  genusSlug: string | null;
  photoUrl: string | null;
  proposedBy: string;
  netVotes: number;
  createdAt: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    const formData = new FormData();
    formData.set("suggestion_id", suggestionId);
    if (genusSlug) formData.set("genus_slug", genusSlug);
    startTransition(async () => {
      const result = await confirmMorphProposal(formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="moderation-row">
      {photoUrl ? (
        <div className="moderation-row-thumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" />
        </div>
      ) : null}
      <div>
        <p style={{ margin: 0 }}>
          <strong>{proposedName}</strong> <span className="muted">({genusName})</span>
        </p>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          Proposed by {proposedBy} · {new Date(createdAt).toLocaleDateString()} · net votes:{" "}
          {netVotes}
        </p>
        {error ? <p className="error">{error}</p> : null}
      </div>
      <div className="moderation-actions">
        <button type="button" disabled={pending} onClick={confirm}>
          {pending ? "Confirming…" : "Confirm now"}
        </button>
      </div>
    </div>
  );
}
