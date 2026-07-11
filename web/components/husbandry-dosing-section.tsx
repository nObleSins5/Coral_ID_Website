"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDosingMethod } from "@/app/tank/[id]/husbandry/actions";
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

const ELEMENTS = ["alkalinity", "calcium", "magnesium"] as const;
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

function ChangeMethodForm({
  tankId,
  element,
  products,
  categories,
  onDone,
}: {
  tankId: string;
  element: string;
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
    formData.set("element", element);
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
      <label htmlFor={`dosing-method-${element}`}>Method</label>
      <select id={`dosing-method-${element}`} name="method" defaultValue="" required>
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
      <p className="muted" style={{ fontSize: "0.8rem", marginTop: "-0.25rem" }}>
        E.g. a calcium reactor doesn&apos;t need a brand/product — leave it blank.
      </p>
      <label htmlFor={`dosing-started-${element}`}>Started on</label>
      <input
        id={`dosing-started-${element}`}
        name="started_on"
        type="date"
        defaultValue={new Date().toISOString().slice(0, 10)}
      />
      <label htmlFor={`dosing-notes-${element}`}>Notes (optional)</label>
      <input id={`dosing-notes-${element}`} name="notes" />
      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

function ElementDrawer({
  tankId,
  element,
  active,
  past,
  products,
  categories,
}: {
  tankId: string;
  element: string;
  active: DosingMethodItem | null;
  past: DosingMethodItem[];
  products: SearchableProduct[];
  categories: Category[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <details className="husbandry-drawer" open={!active}>
      <summary>
        {ELEMENT_LABEL[element]}
        {active ? (
          <span className="muted">
            {" "}
            — {METHOD_LABEL[active.method] ?? active.method}
            {active.productLabel ? ` · ${active.productLabel}` : ""}
          </span>
        ) : (
          <span className="muted"> — not set up yet</span>
        )}
      </summary>
      <div className="husbandry-drawer-body">
        {active ? (
          <p className="muted" style={{ marginTop: 0 }}>
            Since {active.started_on}
            {active.productLabel ? ` · ${active.productLabel}` : " · no product logged"}
          </p>
        ) : null}
        {editing ? (
          <ChangeMethodForm
            tankId={tankId}
            element={element}
            products={products}
            categories={categories}
            onDone={() => setEditing(false)}
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)}>
            {active ? "Change method" : "Set up dosing"}
          </button>
        )}
        {past.length > 0 ? (
          <div style={{ marginTop: "1rem" }}>
            <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "0.35rem" }}>
              Past methods
            </p>
            {past.map((m) => (
              <p key={m.id} className="muted" style={{ fontSize: "0.8rem", margin: "0.2rem 0" }}>
                {METHOD_LABEL[m.method] ?? m.method}
                {m.productLabel ? ` · ${m.productLabel}` : ""} · {m.started_on} → {m.ended_on}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </details>
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
  return (
    <div className="card husbandry-drawers">
      {ELEMENTS.map((element) => {
        const forElement = methods.filter((m) => m.element === element);
        const active = forElement.find((m) => !m.ended_on) ?? null;
        const past = forElement.filter((m) => m.ended_on);
        return (
          <ElementDrawer
            key={element}
            tankId={tankId}
            element={element}
            active={active}
            past={past}
            products={products}
            categories={categories}
          />
        );
      })}
    </div>
  );
}
