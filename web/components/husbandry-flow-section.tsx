"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addFlowEquipment, logEquipmentLevelChange, removeEquipment } from "@/app/tank/[id]/husbandry/actions";

export type FlowEquipmentItem = {
  id: string;
  brand: string | null;
  model: string | null;
  flow_pattern: string | null;
  placement: string | null;
  installed_on: string | null;
  currentLevel: "low" | "med" | "high" | null;
};

const LEVEL_LABEL: Record<string, string> = { low: "Low", med: "Med", high: "High" };
const FLOW_PATTERN_LABEL: Record<string, string> = {
  pulsing: "Pulsing",
  wave_crest: "Wave/crest",
  random: "Random",
  laminar: "Laminar",
  other: "Other",
};
const PLACEMENT_OPTIONS = ["Left", "Right", "Back", "Front", "Center"];

// Rough turnover-based guide, not a fixed GPH number — an "average flow
// rate" pump-side spec means very different real GPH depending on tank
// volume, so a single number would be misleading.
const FLOW_RATE_HELP =
  "Rough guide (as tank turnover): Low ≈ 5–10x volume/hr · Med ≈ 10–20x · High ≈ 20x+. Check your pump's own rated GPH for the exact number.";

function FlowRow({ tankId, item }: { tankId: string; item: FlowEquipmentItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setLevel(level: "low" | "med" | "high") {
    const formData = new FormData();
    formData.set("tank_id", tankId);
    formData.set("equipment_id", item.id);
    formData.set("level", level);
    startTransition(async () => {
      await logEquipmentLevelChange(formData);
      router.refresh();
    });
  }

  function remove() {
    const formData = new FormData();
    formData.set("tank_id", tankId);
    formData.set("equipment_id", item.id);
    startTransition(async () => {
      await removeEquipment(formData);
      router.refresh();
    });
  }

  const label = [item.brand, item.model].filter(Boolean).join(" ") || "Unnamed pump";

  return (
    <div className="husbandry-row">
      <div>
        <p style={{ margin: 0 }}>
          <strong>{label}</strong>{" "}
          {item.flow_pattern ? (
            <span className="pill">{FLOW_PATTERN_LABEL[item.flow_pattern] ?? item.flow_pattern}</span>
          ) : null}
          {item.placement ? <span className="pill">{item.placement}</span> : null}
        </p>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          Installed {item.installed_on}
        </p>
      </div>
      <div className="husbandry-row-actions">
        <span className="level-buttons">
          {(["low", "med", "high"] as const).map((level) => (
            <button
              key={level}
              type="button"
              className={`level-button${item.currentLevel === level ? " selected" : ""}`}
              disabled={pending}
              onClick={() => setLevel(level)}
            >
              {LEVEL_LABEL[level]}
            </button>
          ))}
        </span>
        <button type="button" className="btn-secondary" disabled={pending} onClick={remove}>
          Remove
        </button>
      </div>
    </div>
  );
}

function AddFlowForm({
  tankId,
  seed,
  onDone,
}: {
  tankId: string;
  seed: Partial<FlowEquipmentItem> | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("tank_id", tankId);
    startTransition(async () => {
      const result = await addFlowEquipment(formData);
      if (result?.error) setError(result.error);
      else {
        onDone();
        router.refresh();
      }
    });
  }

  return (
    <form className="add-photo-form card" action={handleSubmit}>
      <div className="row">
        <div>
          <label htmlFor="flow-brand">Brand</label>
          <input id="flow-brand" name="brand" defaultValue={seed?.brand ?? ""} />
        </div>
        <div>
          <label htmlFor="flow-model">Model</label>
          <input id="flow-model" name="model" defaultValue={seed?.model ?? ""} />
        </div>
      </div>
      <label htmlFor="flow-pattern">Flow type</label>
      <select id="flow-pattern" name="flow_pattern" defaultValue={seed?.flow_pattern ?? ""}>
        <option value="">Not sure / not specified</option>
        {Object.entries(FLOW_PATTERN_LABEL).map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
      <label htmlFor="flow-rate">Average flow rate</label>
      <select id="flow-rate" name="average_flow_rate" defaultValue={seed?.currentLevel ?? ""} required>
        <option value="" disabled>
          Choose a rate
        </option>
        <option value="low">Low</option>
        <option value="med">Med</option>
        <option value="high">High</option>
      </select>
      <p className="muted" style={{ fontSize: "0.8rem", marginTop: "-0.25rem" }}>
        {FLOW_RATE_HELP}
      </p>
      <label htmlFor="flow-placement">Placement</label>
      <input
        id="flow-placement"
        name="placement"
        list="flow-placement-options"
        placeholder="e.g. Back left"
      />
      <datalist id="flow-placement-options">
        {PLACEMENT_OPTIONS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <label htmlFor="flow-installed">Installed on</label>
      <input
        id="flow-installed"
        name="installed_on"
        type="date"
        defaultValue={new Date().toISOString().slice(0, 10)}
      />
      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add pump"}
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function HusbandryFlowSection({
  tankId,
  equipment,
}: {
  tankId: string;
  equipment: FlowEquipmentItem[];
}) {
  const [adding, setAdding] = useState(false);
  const [seed, setSeed] = useState<Partial<FlowEquipmentItem> | null>(null);

  function duplicate(item: FlowEquipmentItem) {
    setSeed({ brand: item.brand, model: item.model, flow_pattern: item.flow_pattern, currentLevel: item.currentLevel });
    setAdding(true);
  }

  return (
    <div>
      {equipment.length === 0 ? (
        <p className="muted">No pumps logged yet.</p>
      ) : (
        <div className="card">
          {equipment.map((item) => (
            <div key={item.id} className="husbandry-row-with-duplicate">
              <FlowRow tankId={tankId} item={item} />
              <button
                type="button"
                className="link-button"
                onClick={() => duplicate(item)}
                style={{ fontSize: "0.8rem" }}
              >
                Duplicate this pump →
              </button>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <AddFlowForm
          tankId={tankId}
          seed={seed}
          onDone={() => {
            setAdding(false);
            setSeed(null);
          }}
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)}>
          + Add a pump
        </button>
      )}
    </div>
  );
}
