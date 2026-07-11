"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addLightEquipment, removeEquipment } from "@/app/tank/[id]/husbandry/actions";

export type LightEquipmentItem = {
  id: string;
  brand: string | null;
  model: string | null;
  light_mode: string | null;
  peak_hours: number | null;
  wattage: number | null;
  placement: string | null;
  installed_on: string | null;
};

const LIGHT_MODE_LABEL: Record<string, string> = {
  ramping: "Ramping",
  on_off: "On/off",
};

function LightRow({ tankId, item }: { tankId: string; item: LightEquipmentItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    const formData = new FormData();
    formData.set("tank_id", tankId);
    formData.set("equipment_id", item.id);
    startTransition(async () => {
      await removeEquipment(formData);
      router.refresh();
    });
  }

  const label = [item.brand, item.model].filter(Boolean).join(" ") || "Unnamed light";

  return (
    <div className="husbandry-row">
      <div>
        <p style={{ margin: 0 }}>
          <strong>{label}</strong>{" "}
          {item.light_mode ? (
            <span className="pill">{LIGHT_MODE_LABEL[item.light_mode] ?? item.light_mode}</span>
          ) : null}
          {item.placement ? <span className="pill">Slot {item.placement}</span> : null}
        </p>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          {item.wattage != null ? `${item.wattage}W · ` : ""}
          {item.peak_hours != null ? `${item.peak_hours}h peak · ` : ""}
          installed {item.installed_on}
        </p>
      </div>
      <div className="husbandry-row-actions">
        <button type="button" className="btn-secondary" disabled={pending} onClick={remove}>
          Remove
        </button>
      </div>
    </div>
  );
}

function AddLightForm({
  tankId,
  seed,
  onDone,
}: {
  tankId: string;
  seed: Partial<LightEquipmentItem> | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("tank_id", tankId);
    startTransition(async () => {
      const result = await addLightEquipment(formData);
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
          <label htmlFor="light-brand">Brand</label>
          <input id="light-brand" name="brand" defaultValue={seed?.brand ?? ""} />
        </div>
        <div>
          <label htmlFor="light-model">Model</label>
          <input id="light-model" name="model" defaultValue={seed?.model ?? ""} />
        </div>
      </div>
      <label htmlFor="light-mode">Ramp mode</label>
      <select id="light-mode" name="light_mode" defaultValue={seed?.light_mode ?? ""}>
        <option value="">Not sure / not specified</option>
        <option value="ramping">Ramping (gradual sunrise/sunset)</option>
        <option value="on_off">On/off</option>
      </select>
      <div className="row">
        <div>
          <label htmlFor="light-peak-hours">Peak hours (per day)</label>
          <input
            id="light-peak-hours"
            name="peak_hours"
            type="number"
            min="0"
            step="0.5"
            defaultValue={seed?.peak_hours ?? undefined}
          />
        </div>
        <div>
          <label htmlFor="light-wattage">Wattage</label>
          <input
            id="light-wattage"
            name="wattage"
            type="number"
            min="0"
            step="1"
            defaultValue={seed?.wattage ?? undefined}
          />
        </div>
      </div>
      <label htmlFor="light-placement">Placement (slot #)</label>
      <input id="light-placement" name="placement" placeholder="e.g. 2" />
      <label htmlFor="light-installed">Installed on</label>
      <input
        id="light-installed"
        name="installed_on"
        type="date"
        defaultValue={new Date().toISOString().slice(0, 10)}
      />
      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add light"}
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function HusbandryLightSection({
  tankId,
  equipment,
}: {
  tankId: string;
  equipment: LightEquipmentItem[];
}) {
  const [adding, setAdding] = useState(false);
  const [seed, setSeed] = useState<Partial<LightEquipmentItem> | null>(null);

  function duplicate(item: LightEquipmentItem) {
    setSeed({
      brand: item.brand,
      model: item.model,
      light_mode: item.light_mode,
      peak_hours: item.peak_hours,
      wattage: item.wattage,
    });
    setAdding(true);
  }

  return (
    <div>
      {equipment.length === 0 ? (
        <p className="muted">No lights logged yet.</p>
      ) : (
        <div className="card">
          {equipment.map((item) => (
            <div key={item.id} className="husbandry-row-with-duplicate">
              <LightRow tankId={tankId} item={item} />
              <button
                type="button"
                className="link-button"
                onClick={() => duplicate(item)}
                style={{ fontSize: "0.8rem" }}
              >
                Duplicate this light →
              </button>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <AddLightForm
          tankId={tankId}
          seed={seed}
          onDone={() => {
            setAdding(false);
            setSeed(null);
          }}
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)}>
          + Add a light
        </button>
      )}
    </div>
  );
}
