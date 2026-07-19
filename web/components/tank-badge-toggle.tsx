"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTankBadgeEnabled } from "@/app/tank/actions";
import { SITE_URL } from "@/lib/site";

// Available to every account type (unlike TankPublishToggle, which is
// business-only and publishes the full grid) — this only ever exposes
// current parameters + a species list (see 32_tank_badge.sql), a much
// narrower disclosure that any hobbyist sharing a forum signature might want.
function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ marginBottom: "0.6rem" }}>
      <p className="muted" style={{ margin: "0 0 0.2rem", fontSize: "0.8rem" }}>
        {label}
      </p>
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <input readOnly value={value} onFocus={(e) => e.target.select()} style={{ flex: 1 }} />
        <button type="button" className="btn-secondary" onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function TankBadgeToggle({
  tankId,
  badgeEnabled,
}: {
  tankId: string;
  badgeEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    const formData = new FormData();
    formData.set("tank_id", tankId);
    formData.set("badge_enabled", (!badgeEnabled).toString());
    startTransition(async () => {
      const result = await setTankBadgeEnabled(formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  const badgeUrl = `${SITE_URL}/badge/${tankId}`;
  const showcaseUrl = `${SITE_URL}/showcase/${tankId}`;
  const bbcode = `[URL=${showcaseUrl}][IMG]${badgeUrl}[/IMG][/URL]`;
  const html = `<a href="${showcaseUrl}"><img src="${badgeUrl}" alt="My ReefCodex tank"></a>`;

  return (
    <div className="card" style={{ marginBottom: "1.25rem" }}>
      <p style={{ marginTop: 0, marginBottom: "0.4rem", fontWeight: 600 }}>Forum signature badge</p>
      {badgeEnabled ? (
        <>
          <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
            A pastable badge with your current parameters and species, linking to your
            public tank page — paste the snippet below into a forum signature.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badgeUrl} alt="Badge preview" style={{ marginBottom: "0.75rem", borderRadius: 10 }} />
          <CopyBox label="BBCode (most forums)" value={bbcode} />
          <CopyBox label="HTML" value={html} />
          <button type="button" className="btn-secondary" disabled={pending} onClick={toggle}>
            {pending ? "Disabling…" : "Disable badge"}
          </button>
        </>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
            Get a pastable badge showing your current parameters and species, for forum
            signatures — doesn&apos;t publish your grid.
          </p>
          <button type="button" disabled={pending} onClick={toggle}>
            {pending ? "Enabling…" : "Enable badge"}
          </button>
        </>
      )}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
