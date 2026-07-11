"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addTankAdditive, endTankAdditive } from "@/app/tank/[id]/husbandry/actions";
import { ProductPicker } from "@/components/product-picker";
import type { SearchableProduct } from "@/lib/husbandry";

export type TankAdditiveItem = {
  id: string;
  productLabel: string;
  started_on: string | null;
  ended_on: string | null;
  notes: string | null;
};
type Category = { code: string; label: string };

function AdditiveRow({ tankId, item }: { tankId: string; item: TankAdditiveItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function end() {
    const formData = new FormData();
    formData.set("tank_id", tankId);
    formData.set("tank_additive_id", item.id);
    startTransition(async () => {
      await endTankAdditive(formData);
      router.refresh();
    });
  }

  return (
    <div className="husbandry-row">
      <div>
        <p style={{ margin: 0 }}>
          <strong>{item.productLabel}</strong>
        </p>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          since {item.started_on}
          {item.ended_on ? ` · ended ${item.ended_on}` : ""}
          {item.notes ? ` · ${item.notes}` : ""}
        </p>
      </div>
      {!item.ended_on ? (
        <button type="button" className="btn-secondary" disabled={pending} onClick={end}>
          End
        </button>
      ) : null}
    </div>
  );
}

function AddAdditiveForm({
  tankId,
  products,
  categories,
  onDone,
}: {
  tankId: string;
  products: SearchableProduct[];
  categories: Category[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("tank_id", tankId);
    startTransition(async () => {
      const result = await addTankAdditive(formData);
      if (result?.error) setError(result.error);
      else {
        onDone();
        router.refresh();
      }
    });
  }

  return (
    <form className="add-photo-form card" action={handleSubmit}>
      <ProductPicker products={products} categories={categories} required />
      <label htmlFor="additive-started">Started on</label>
      <input
        id="additive-started"
        name="started_on"
        type="date"
        defaultValue={new Date().toISOString().slice(0, 10)}
      />
      <label htmlFor="additive-notes">Notes (optional)</label>
      <input id="additive-notes" name="notes" />
      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add additive"}
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function HusbandryAdditiveSection({
  tankId,
  additives,
  products,
  categories,
}: {
  tankId: string;
  additives: TankAdditiveItem[];
  products: SearchableProduct[];
  categories: Category[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      {additives.length === 0 ? (
        <p className="muted">No additives logged yet.</p>
      ) : (
        <div className="card">
          {additives.map((item) => (
            <AdditiveRow key={item.id} tankId={tankId} item={item} />
          ))}
        </div>
      )}
      {adding ? (
        <AddAdditiveForm
          tankId={tankId}
          products={products}
          categories={categories}
          onDone={() => setAdding(false)}
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)}>
          + Add additive
        </button>
      )}
    </div>
  );
}
