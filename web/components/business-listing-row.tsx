"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deactivateAffiliateLink, updateAffiliateListing } from "@/app/affiliate/actions";

export type BusinessListing = {
  id: string;
  vendor_name: string;
  url: string;
  link_type: string;
  is_active: boolean;
  for_sale_or_trade: boolean;
  price: number | null;
  hidden_by_owner: boolean;
  photoUrl: string;
  morphName: string;
  morphHref: string | null;
};

export function BusinessListingRow({ listing }: { listing: BusinessListing }) {
  const router = useRouter();
  const [forSale, setForSale] = useState(listing.for_sale_or_trade);
  const [hidden, setHidden] = useState(listing.hidden_by_owner);
  const [price, setPrice] = useState(listing.price != null ? String(listing.price) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    const formData = new FormData();
    formData.set("affiliate_link_id", listing.id);
    if (forSale) formData.set("for_sale_or_trade", "on");
    if (hidden) formData.set("hidden_by_owner", "on");
    formData.set("price", price);
    startTransition(async () => {
      const result = await updateAffiliateListing(formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleDeactivate() {
    const formData = new FormData();
    formData.set("affiliate_link_id", listing.id);
    startTransition(async () => {
      await deactivateAffiliateLink(formData);
      router.refresh();
    });
  }

  return (
    <div className="card business-listing-row">
      <div className="business-listing-summary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={listing.photoUrl} alt="" className="business-listing-thumb" />
        <div>
          <p style={{ marginTop: 0, marginBottom: "0.2rem", fontWeight: 600 }}>
            {listing.vendor_name}{" "}
            {!listing.is_active ? <span className="pill">inactive</span> : null}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
            {listing.morphHref ? (
              <a href={listing.morphHref}>{listing.morphName}</a>
            ) : (
              listing.morphName
            )}{" "}
            · {listing.link_type === "wysiwyg" ? "this exact frag" : "this morph"}
          </p>
        </div>
      </div>

      <div className="business-listing-controls">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={forSale}
            onChange={(e) => setForSale(e.target.checked)}
          />
          For sale/trade
        </label>
        <label>
          Price
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="No price"
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={hidden}
            onChange={(e) => setHidden(e.target.checked)}
          />
          Hide from public listing
        </label>
        <div className="form-actions">
          <button type="button" onClick={handleSave} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          {listing.is_active ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDeactivate}
              disabled={pending}
            >
              Deactivate
            </button>
          ) : null}
        </div>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}
