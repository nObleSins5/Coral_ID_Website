"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moderateAlias, moderateProduct, restoreComment, deleteReportedComment, moderateColorSample } from "@/app/moderate/actions";

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

export function ColorSampleModerationRow({
  sampleId,
  usedHex,
  rawHex,
  elementLabel,
  taxonName,
  taxonHref,
  submittedBy,
  deltaE,
  outOfRange,
  createdAt,
}: {
  sampleId: string;
  usedHex: string;
  rawHex: string;
  elementLabel: string;
  taxonName: string;
  taxonHref: string | null;
  submittedBy: string;
  deltaE: number | null;
  outOfRange: boolean;
  createdAt: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(decision: "approved" | "rejected") {
    setError(null);
    const formData = new FormData();
    formData.set("sample_id", sampleId);
    formData.set("decision", decision);
    startTransition(async () => {
      const result = await moderateColorSample(formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="moderation-row">
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <span
          className="cp-sample-swatch"
          style={{ width: 40, height: 40, borderRadius: 8, background: usedHex }}
          aria-hidden="true"
        />
        <div>
          <p style={{ margin: 0 }}>
            <strong>{elementLabel}</strong> <span className="hex">{usedHex}</span>{" "}
            on {taxonHref ? <a href={taxonHref}>{taxonName}</a> : taxonName}{" "}
            {outOfRange ? (
              <span className="pill" style={{ color: "var(--danger)" }}>out of range</span>
            ) : deltaE === null ? (
              <span className="pill">no range yet</span>
            ) : null}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            raw {rawHex}
            {deltaE !== null ? ` · ΔE ${deltaE.toFixed(1)}` : ""} · by {submittedBy} ·{" "}
            {new Date(createdAt).toLocaleDateString()}
          </p>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </div>
      <div className="moderation-actions">
        <button type="button" disabled={pending} onClick={() => decide("approved")}>
          Approve
        </button>
        <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide("rejected")}>
          Reject
        </button>
      </div>
    </div>
  );
}
