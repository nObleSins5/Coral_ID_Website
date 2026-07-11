"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moderateAlias, moderateProduct } from "@/app/moderate/actions";

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
