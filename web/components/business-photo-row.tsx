"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addAffiliateLink,
  deactivateAffiliateLink,
  updateAffiliateListing,
} from "@/app/affiliate/actions";

export type BusinessLink = {
  id: string;
  vendor_name: string;
  url: string;
  link_type: string;
  is_active: boolean;
  for_sale_or_trade: boolean;
  price: number | null;
  hidden_by_owner: boolean;
};

export type BusinessPhoto = {
  photoId: string;
  photoUrl: string;
  morphName: string;
  morphHref: string | null;
  genusSlug: string | null;
  morphSlug: string | null;
  links: BusinessLink[];
};

function AffiliateLinkControls({
  link,
  genusSlug,
  morphSlug,
}: {
  link: BusinessLink;
  genusSlug: string | null;
  morphSlug: string | null;
}) {
  const router = useRouter();
  const [forSale, setForSale] = useState(link.for_sale_or_trade);
  const [hidden, setHidden] = useState(link.hidden_by_owner);
  const [price, setPrice] = useState(link.price != null ? String(link.price) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    const formData = new FormData();
    formData.set("affiliate_link_id", link.id);
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
    formData.set("affiliate_link_id", link.id);
    if (genusSlug) formData.set("genus_slug", genusSlug);
    if (morphSlug) formData.set("morph_slug", morphSlug);
    startTransition(async () => {
      await deactivateAffiliateLink(formData);
      router.refresh();
    });
  }

  return (
    <div className="business-link-controls">
      <p className="muted" style={{ margin: "0 0 0.3rem", fontSize: "0.8rem" }}>
        {link.vendor_name} · {link.link_type === "wysiwyg" ? "this exact frag" : "this morph"}
        {!link.is_active ? " · inactive" : ""}
      </p>
      <label className="checkbox-label">
        <input type="checkbox" checked={forSale} onChange={(e) => setForSale(e.target.checked)} />
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
        <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
        Hide
      </label>
      <div className="form-actions">
        <button type="button" onClick={handleSave} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        {link.is_active ? (
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
  );
}

function AddListingForm({
  photoId,
  genusSlug,
  morphSlug,
}: {
  photoId: string;
  genusSlug: string | null;
  morphSlug: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        + Add a listing
      </button>
    );
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("coral_photo_id", photoId);
    if (genusSlug) formData.set("genus_slug", genusSlug);
    if (morphSlug) formData.set("morph_slug", morphSlug);
    startTransition(async () => {
      const result = await addAffiliateLink(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <form className="add-photo-form" action={handleSubmit}>
      <label htmlFor={`vendor-${photoId}`}>Vendor name</label>
      <input id={`vendor-${photoId}`} name="vendor_name" required />
      <label htmlFor={`url-${photoId}`}>Link URL</label>
      <input id={`url-${photoId}`} name="url" type="url" required placeholder="https://" />
      <label htmlFor={`type-${photoId}`}>Link type</label>
      <select id={`type-${photoId}`} name="link_type" defaultValue="representative">
        <option value="wysiwyg">This exact frag (may already be sold)</option>
        <option value="representative">This morph in general</option>
      </select>
      <label htmlFor={`price-${photoId}`}>Price (optional)</label>
      <input id={`price-${photoId}`} name="price" type="number" min="0" step="0.01" />
      <label className="checkbox-label">
        <input type="checkbox" name="for_sale_or_trade" defaultChecked />
        Currently for sale/trade
      </label>
      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

// One table row per posted photo of a confirmed community morph (not per
// affiliate link — a business may post a photo before ever listing it for
// sale). Existing links show their toggle controls; either way an
// "add another listing" control is always available.
export function BusinessPhotoRow({ photo }: { photo: BusinessPhoto }) {
  return (
    <tr className="business-photo-row">
      <td>{photo.morphHref ? <a href={photo.morphHref}>{photo.morphName}</a> : photo.morphName}</td>
      <td>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.photoUrl} alt="" className="business-listing-thumb" />
      </td>
      <td>
        {photo.links.map((link) => (
          <AffiliateLinkControls
            key={link.id}
            link={link}
            genusSlug={photo.genusSlug}
            morphSlug={photo.morphSlug}
          />
        ))}
        <AddListingForm
          photoId={photo.photoId}
          genusSlug={photo.genusSlug}
          morphSlug={photo.morphSlug}
        />
      </td>
    </tr>
  );
}
