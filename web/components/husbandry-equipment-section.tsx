"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addEquipment, logEquipmentLevelChange, removeEquipment } from "@/app/tank/[id]/husbandry/actions";

export type EquipmentLevel = { level: "low" | "med" | "high"; percent: number | null };
export type EquipmentItem = {
  id: string;
  equipment_type_code: string;
  brand: string | null;
  model: string | null;
  name: string | null;
  installed_on: string | null;
  levels: EquipmentLevel[];
  currentLevel: "low" | "med" | "high" | null;
};
type EquipmentType = { code: string; label: string };

const LEVEL_LABEL: Record<string, string> = { low: "Low", med: "Med", high: "High" };

function EquipmentRow({ tankId, item }: { tankId: string; item: EquipmentItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isLightOrFlow = item.equipment_type_code === "light" || item.equipment_type_code === "flow";

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

  const label = item.name || [item.brand, item.model].filter(Boolean).join(" ") || "Unnamed";

  return (
    <div className="husbandry-row">
      <div>
        <p style={{ margin: 0 }}>
          <strong>{label}</strong>{" "}
          {item.currentLevel ? (
            <span className="pill">Running: {LEVEL_LABEL[item.currentLevel]}</span>
          ) : null}
        </p>
        {item.brand && item.name ? (
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            {[item.brand, item.model].filter(Boolean).join(" ")}
          </p>
        ) : null}
      </div>
      <div className="husbandry-row-actions">
        {isLightOrFlow && item.levels.length > 0 ? (
          <span className="level-buttons">
            {item.levels.map((l) => (
              <button
                key={l.level}
                type="button"
                className={`level-button${item.currentLevel === l.level ? " selected" : ""}`}
                disabled={pending}
                onClick={() => setLevel(l.level)}
                title={l.percent != null ? `${l.percent}%` : undefined}
              >
                {LEVEL_LABEL[l.level]}
                {l.percent != null ? ` (${l.percent}%)` : ""}
              </button>
            ))}
          </span>
        ) : null}
        <button type="button" className="btn-secondary" disabled={pending} onClick={remove}>
          Remove
        </button>
      </div>
    </div>
  );
}

function AddEquipmentForm({
  tankId,
  equipmentTypes,
  onDone,
}: {
  tankId: string;
  equipmentTypes: EquipmentType[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [typeCode, setTypeCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const showLevels = typeCode === "light" || typeCode === "flow";

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("tank_id", tankId);
    startTransition(async () => {
      const result = await addEquipment(formData);
      if (result?.error) setError(result.error);
      else {
        onDone();
        router.refresh();
      }
    });
  }

  return (
    <form className="add-photo-form card" action={handleSubmit}>
      <label htmlFor="equipment-type">Type</label>
      <select
        id="equipment-type"
        name="equipment_type_code"
        value={typeCode}
        onChange={(e) => setTypeCode(e.target.value)}
        required
      >
        <option value="" disabled>
          Choose a type
        </option>
        {equipmentTypes.map((t) => (
          <option key={t.code} value={t.code}>
            {t.label}
          </option>
        ))}
      </select>
      <label htmlFor="equipment-name">Name (optional)</label>
      <input id="equipment-name" name="name" placeholder="e.g. Display light" />
      <div className="row">
        <div>
          <label htmlFor="equipment-brand">Brand (optional)</label>
          <input id="equipment-brand" name="brand" />
        </div>
        <div>
          <label htmlFor="equipment-model">Model (optional)</label>
          <input id="equipment-model" name="model" />
        </div>
      </div>
      <label htmlFor="equipment-installed">Installed on</label>
      <input
        id="equipment-installed"
        name="installed_on"
        type="date"
        defaultValue={new Date().toISOString().slice(0, 10)}
      />
      {showLevels ? (
        <>
          <label>Low/Med/High setpoints (optional, %)</label>
          <div className="row">
            <input name="level_low_percent" type="number" min="0" max="100" placeholder="Low %" />
            <input name="level_med_percent" type="number" min="0" max="100" placeholder="Med %" />
            <input name="level_high_percent" type="number" min="0" max="100" placeholder="High %" />
          </div>
        </>
      ) : null}
      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add equipment"}
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function HusbandryEquipmentSection({
  tankId,
  equipment,
  equipmentTypes,
}: {
  tankId: string;
  equipment: EquipmentItem[];
  equipmentTypes: EquipmentType[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      {equipment.length === 0 ? (
        <p className="muted">No equipment logged yet.</p>
      ) : (
        <div className="card">
          {equipment.map((item) => (
            <EquipmentRow key={item.id} tankId={tankId} item={item} />
          ))}
        </div>
      )}
      {adding ? (
        <AddEquipmentForm tankId={tankId} equipmentTypes={equipmentTypes} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)}>
          + Add equipment
        </button>
      )}
    </div>
  );
}
