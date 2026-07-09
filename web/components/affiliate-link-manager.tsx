"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addAffiliateLink, deactivateAffiliateLink } from "@/app/affiliate/actions";

type Link = {
  id: string;
  vendor_name: string;
  url: string;
  link_type: string;
  is_active: boolean;
};

// Shown on a photo card, but only renders anything for that photo's own
// uploader, AND only if they're a business-tier account (affiliate links
// became business-only in 2026-07 — see sql/supabase/12_business_listings.sql;
// hobbyist-to-hobbyist trade flagging is a separate, not-yet-built feature).
// Fetches its own data client-side because morph pages are statically
// generated with no per-request auth (see AddSpecimenForm/AddPhotoForm for
// the same pattern).
export function AffiliateLinkManager({
  photoId,
  uploaderUserId,
  genusSlug,
  morphSlug,
}: {
  photoId: string;
  uploaderUserId: string;
  genusSlug: string;
  morphSlug: string;
}) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isBusiness, setIsBusiness] = useState(false);
  const [links, setLinks] = useState<Link[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (user && user.id === uploaderUserId) {
        const { data: profile } = await supabase
          .from("users")
          .select("account_type_code")
          .eq("id", user.id)
          .maybeSingle();
        setIsBusiness(profile?.account_type_code === "business");
        const { data } = await supabase
          .from("affiliate_links")
          .select("id, vendor_name, url, link_type, is_active")
          .eq("coral_photo_id", photoId)
          .order("created_at", { ascending: false });
        setLinks(data ?? []);
      }
      setLoaded(true);
    })();
  }, [photoId, uploaderUserId]);

  if (!loaded || userId !== uploaderUserId || !isBusiness) return null;

  function handleAdd(formData: FormData) {
    setError(null);
    formData.set("coral_photo_id", photoId);
    formData.set("genus_slug", genusSlug);
    formData.set("morph_slug", morphSlug);
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

  function handleDeactivate(id: string) {
    const formData = new FormData();
    formData.set("affiliate_link_id", id);
    formData.set("genus_slug", genusSlug);
    formData.set("morph_slug", morphSlug);
    startTransition(async () => {
      await deactivateAffiliateLink(formData);
      router.refresh();
    });
  }

  return (
    <div className="affiliate-manager">
      {links.length > 0 ? (
        <ul className="affiliate-manager-list">
          {links.map((l) => (
            <li key={l.id}>
              <span>
                {l.vendor_name} ·{" "}
                {l.link_type === "wysiwyg" ? "this exact frag" : "this morph"}
                {!l.is_active ? " · inactive" : ""}
              </span>
              {l.is_active ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleDeactivate(l.id)}
                  disabled={pending}
                >
                  Deactivate
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <form action={handleAdd} className="add-photo-form">
          <label htmlFor={`vendor-${photoId}`}>Vendor name</label>
          <input id={`vendor-${photoId}`} name="vendor_name" required />

          <label htmlFor={`url-${photoId}`}>Link URL</label>
          <input
            id={`url-${photoId}`}
            name="url"
            type="url"
            required
            placeholder="https://"
          />

          <label htmlFor={`type-${photoId}`}>Link type</label>
          <select id={`type-${photoId}`} name="link_type" defaultValue="representative">
            <option value="wysiwyg">This exact frag (may already be sold)</option>
            <option value="representative">This morph in general</option>
          </select>

          <label htmlFor={`price-${photoId}`}>Price (optional)</label>
          <input
            id={`price-${photoId}`}
            name="price"
            type="number"
            min="0"
            step="0.01"
            placeholder="Leave blank to show no price"
          />

          <label className="checkbox-label">
            <input type="checkbox" name="for_sale_or_trade" defaultChecked />
            Currently for sale/trade
          </label>

          <div className="form-actions">
            <button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add link"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </form>
      ) : (
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
          Selling this? Add your link
        </button>
      )}
    </div>
  );
}
