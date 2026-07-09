"use client";

import { useState, useTransition } from "react";
import { approveAlias, rejectAlias } from "@/app/admin/actions";

export type PendingAlias = {
  aliasId: string;
  aliasName: string;
  morphName: string;
  morphHref: string | null;
  proposedByUsername: string;
  createdAt: string;
};

export function AliasModerationRow({ alias }: { alias: PendingAlias }) {
  const [resolved, setResolved] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(action: "approve" | "reject") {
    setError(null);
    const formData = new FormData();
    formData.set("alias_id", alias.aliasId);
    startTransition(async () => {
      const result = await (action === "approve" ? approveAlias(formData) : rejectAlias(formData));
      if (result.error) setError(result.error);
      else setResolved(action === "approve" ? "approved" : "rejected");
    });
  }

  if (resolved) {
    return (
      <tr>
        <td colSpan={4} className="muted">
          &ldquo;{alias.aliasName}&rdquo; {resolved}.
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{alias.aliasName}</td>
      <td>
        {alias.morphHref ? <a href={alias.morphHref}>{alias.morphName}</a> : alias.morphName}
      </td>
      <td>{alias.proposedByUsername}</td>
      <td>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => submit("approve")}
          >
            Approve
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => submit("reject")}
          >
            Reject
          </button>
        </div>
        {error && <p className="muted" style={{ color: "var(--danger)", margin: "0.25rem 0 0" }}>{error}</p>}
      </td>
    </tr>
  );
}
