"use client";

import { useMemo, useState } from "react";
import type { SearchableProduct } from "@/lib/husbandry";

type Category = { code: string; label: string };

// Search-or-propose control for a husbandry_products reference, embedded
// directly inside a parent <form> (not its own form) — same shape as
// ProposeIdentificationForm's search-vs-propose-new split. A picked product
// sets a hidden product_id input; proposing a new one sets new_brand /
// new_product_name / new_category_code instead, resolved server-side by
// lib/husbandry.ts's resolveOrCreateProduct.
export function ProductPicker({
  products,
  categories,
  required,
}: {
  products: SearchableProduct[];
  categories: Category[];
  required?: boolean;
}) {
  const [mode, setMode] = useState<"search" | "new">("search");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SearchableProduct | null>(null);

  const results = useMemo(() => {
    if (selected || mode !== "search" || query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return products
      .filter(
        (p) => p.brand.toLowerCase().includes(q) || p.product_name.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, selected, mode, products]);

  if (mode === "new") {
    return (
      <div className="product-picker">
        <label htmlFor="new-product-brand">Brand</label>
        <input id="new-product-brand" name="new_brand" required />
        <label htmlFor="new-product-name">Product name</label>
        <input id="new-product-name" name="new_product_name" required />
        <label htmlFor="new-product-category">Category</label>
        <select id="new-product-category" name="new_category_code" defaultValue="" required>
          <option value="" disabled>
            Choose a category
          </option>
          {categories.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        <p className="muted propose-switch">
          <button type="button" className="link-button" onClick={() => setMode("search")}>
            Actually, let me search existing products
          </button>
        </p>
        <p className="muted" style={{ fontSize: "0.8rem" }}>
          New products go to a moderator for review before they&apos;re public
          — you can still use it in your own log right away.
        </p>
      </div>
    );
  }

  return (
    <div className="product-picker">
      <label htmlFor="product-search">Product{required ? "" : " (optional)"}</label>
      <input
        id="product-search"
        value={selected ? `${selected.brand} ${selected.product_name}` : query}
        onChange={(e) => {
          setSelected(null);
          setQuery(e.target.value);
        }}
        placeholder="e.g. Red Sea Reef Foundation B"
      />
      {selected ? <input type="hidden" name="product_id" value={selected.id} /> : null}
      {results.length > 0 && (
        <div className="taxon-results">
          {results.map((p) => (
            <button
              type="button"
              key={p.id}
              className="taxon-result"
              onClick={() => {
                setSelected(p);
                setQuery("");
              }}
            >
              {p.brand} <span className="muted">{p.product_name}</span>
            </button>
          ))}
        </div>
      )}
      <p className="muted propose-switch">
        Can&apos;t find it?{" "}
        <button type="button" className="link-button" onClick={() => setMode("new")}>
          Add a new product
        </button>
      </p>
    </div>
  );
}
