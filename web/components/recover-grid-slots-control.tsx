"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recoverGridSlots } from "@/app/tank/actions";
import type { GridSlotData } from "@/components/tank-grid-interactive";

// The only way back for a slot marked "Not usable for coral"
// (grid-slot-panel.tsx) — that flag hides the cell entirely, with no click
// target left to toggle it back one at a time, so this offers a bulk
// undo: filter by tier, multi-select however many locations, recover them
// all in one submit. Collapsed behind a summary button until opened, same
// pattern as the rest of this page's disclosures.
export function RecoverGridSlotsControl({
  tankId,
  disabledSlots,
}: {
  tankId: string;
  disabledSlots: GridSlotData[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tierFilter, setTierFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (disabledSlots.length === 0) return null;

  const tiers = [...new Set(disabledSlots.map((s) => s.z))].sort((a, b) => a - b);
  const visible =
    tierFilter === "all" ? disabledSlots : disabledSlots.filter((s) => s.z === Number(tierFilter));

  function toggleSelection(values: string[]) {
    setSelected(new Set(values));
  }

  function selectAllVisible() {
    setSelected(new Set(visible.map((s) => s.id)));
  }

  function submit() {
    if (selected.size === 0) {
      setError("Choose at least one location.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("tank_id", tankId);
      selected.forEach((id) => formData.append("grid_slot_ids", id));
      const result = await recoverGridSlots(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSelected(new Set());
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        {disabledSlots.length} location{disabledSlots.length === 1 ? "" : "s"} marked not usable —
        recover?
      </button>
    );
  }

  return (
    <div className="card recover-slots-panel">
      <p style={{ marginTop: 0, fontWeight: 600 }}>Recover removed grid locations</p>

      <label htmlFor="recover-slots-tier">Filter by tier</label>
      <select
        id="recover-slots-tier"
        value={tierFilter}
        onChange={(e) => setTierFilter(e.target.value)}
      >
        <option value="all">All tiers</option>
        {tiers.map((t) => (
          <option key={t} value={t}>
            Tier {t}
          </option>
        ))}
      </select>

      <label htmlFor="recover-slots-select">Locations (select multiple)</label>
      <select
        id="recover-slots-select"
        multiple
        size={Math.min(8, Math.max(3, visible.length))}
        value={[...selected]}
        onChange={(e) => toggleSelection(Array.from(e.target.selectedOptions).map((o) => o.value))}
      >
        {visible.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={selectAllVisible}>
          Select all visible
        </button>
      </div>
      <div className="form-actions">
        <button type="button" disabled={pending || selected.size === 0} onClick={submit}>
          {pending ? "Recovering…" : "Recover removed grid locations"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
