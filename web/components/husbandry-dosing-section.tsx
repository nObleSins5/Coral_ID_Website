"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDosingMethod, endDosingMethod } from "@/app/tank/[id]/husbandry/actions";
import { ProductPicker } from "@/components/product-picker";
import type { SearchableProduct } from "@/lib/husbandry";

export type DosingMethodItem = {
  id: string;
  element: string;
  method: string;
  started_on: string | null;
  ended_on: string | null;
  productLabel: string | null;
};
type Category = { code: string; label: string };

const ELEMENT_LABEL: Record<string, string> = {
  alkalinity: "Alkalinity",
  calcium: "Calcium",
  magnesium: "Magnesium",
};
const METHOD_LABEL: Record<string, string> = {
  two_part: "2-part",
  balling: "Balling",
  kalkwasser: "Kalkwasser",
  calcium_reactor: "Calcium reactor",
  dosed_supplement: "Dosed supplement",
  water_change_only: "Water change only",
  other: "Other",
};

function DosingRow({ tankId, item }: { tankId: string; item: DosingMethodItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function end() {
    const formData = new FormData();
    formData.set("tank_id", tankId);
    formData.set("dosing_method_id", item.id);
    startTransition(async () => {
      await endDosingMethod(formData);
      router.refresh();
    });
  }

  return (
    <div className="husbandry-row">
      <div>
        <p style={{ margin: 0 }}>
          <strong>{ELEMENT_LABEL[item.element] ?? item.element}</strong>{" "}
          <span className="pill">{METHOD_LABEL[item.method] ?? item.method}</span>
        </p>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          {item.productLabel ? `${item.productLabel} · ` : ""}
          since {item.started_on}
          {item.ended_on ? ` · ended ${item.ended_on}` : ""}
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

function AddDosingMethodForm({
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
      const result = await addDosingMethod(formData);
      if (result?.error) setError(result.error);
      else {
        onDone();
        router.refresh();
      }
    });
  }

  return (
    <form className="add-photo-form card" action={handleSubmit}>
      <label htmlFor="dosing-element">Element</label>
      <select id="dosing-element" name="element" defaultValue="" required>
        <option value="" disabled>
          Choose an element
        </option>
        {Object.entries(ELEMENT_LABEL).map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
      <label htmlFor="dosing-method">Method</label>
      <select id="dosing-method" name="method" defaultValue="" required>
        <option value="" disabled>
          Choose a method
        </option>
        {Object.entries(METHOD_LABEL).map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
      <ProductPicker products={products} categories={categories} />
      <label htmlFor="dosing-started">Started on</label>
      <input
        id="dosing-started"
        name="started_on"
        type="date"
        defaultValue={new Date().toISOString().slice(0, 10)}
      />
      <label htmlFor="dosing-notes">Notes (optional)</label>
      <input id="dosing-notes" name="notes" />
      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add dosing method"}
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function HusbandryDosingSection({
  tankId,
  methods,
  products,
  categories,
}: {
  tankId: string;
  methods: DosingMethodItem[];
  products: SearchableProduct[];
  categories: Category[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      {methods.length === 0 ? (
        <p className="muted">No dosing methods logged yet.</p>
      ) : (
        <div className="card">
          {methods.map((item) => (
            <DosingRow key={item.id} tankId={tankId} item={item} />
          ))}
        </div>
      )}
      {adding ? (
        <AddDosingMethodForm
          tankId={tankId}
          products={products}
          categories={categories}
          onDone={() => setAdding(false)}
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)}>
          + Add dosing method
        </button>
      )}
    </div>
  );
}
