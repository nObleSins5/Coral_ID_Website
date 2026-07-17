"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  COLOR_FAMILIES,
  familyLabel,
  scoreCoralMatch,
  type ColorFamily,
} from "@/lib/color-match";
import type { ColorMatchCoral, FunnelCategory } from "@/lib/wiki";
import { extractCoralTraitsFromPhoto } from "@/app/identify/vision-actions";

// A larger look at the user's own uploaded photo, purely client-side (the
// photo is never persisted — see PhotoTraitAssist below) — for actually
// comparing fine color/pattern detail against the ranked results' reference
// photos, which a thumbnail-sized preview can't support.
function PhotoLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel photo-lightbox-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id={titleId} style={{ margin: 0 }}>
            Your photo
          </h3>
          <button type="button" ref={closeRef} className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Your uploaded coral photo, enlarged" className="photo-lightbox-img" />
      </div>
    </div>
  );
}

const SWATCH: Record<ColorFamily, string> = Object.fromEntries(
  COLOR_FAMILIES.map((f) => [f.code, f.swatch]),
) as Record<ColorFamily, string>;

const LIGHTING_CAVEAT: Record<string, string> = {
  actinic:
    "Looks like this was shot under blue/actinic reef lighting, which shifts how colors read — the colors above are our best guess, but daylight might look different.",
  mixed:
    "This photo mixes lighting types, which can shift how colors read — treat the colors above as a starting point.",
};

// Identify-MVP Phase 2 — optional photo upload that pre-fills the funnel's
// own color picks via a vision model (see app/identify/vision-actions.ts).
// The photo is never persisted; everything it fills in stays exactly as
// editable as if the user had tapped it themselves, and is presented as a
// suggestion, not a verdict — the user still confirms via the same chips.
//
// Deliberately does NOT auto-apply the model's shape/category guess (only
// surfaces it as text) — colors only ever affect *ranking* (scoreCoralMatch
// degrades gracefully on a miss), but category is a hard FILTER in the
// funnel below, so a wrong category guess doesn't just misrank the right
// answer, it silently removes it from the results entirely. Confirmed live
// during Phase 2 verification: Rasta Zoanthid's own reference photo got
// guessed as "Large Polyp Stony" (a defensible mistake — a top-down zoa
// colony can visually read as LPS), which made the correct coral vanish
// from an otherwise-correct color match. The user still sees the guess and
// can apply it themselves in Step 1 if they agree.
function PhotoTraitAssist({
  categories,
  onExtracted,
}: {
  categories: FunnelCategory[];
  onExtracted: (families: ColorFamily[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lighting, setLighting] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);
  const [suggestedCategoryName, setSuggestedCategoryName] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Object URLs are memory-held by the browser until revoked — clean up the
  // previous one whenever a new photo replaces it, and on unmount.
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setLighting(null);
    setSuggestedCategoryName(null);
    setPhotoUrl(URL.createObjectURL(file));
    const formData = new FormData();
    formData.set("photo", file);
    startTransition(async () => {
      const response = await extractCoralTraitsFromPhoto(formData);
      if ("error" in response) {
        setError(response.error);
        return;
      }
      const { categorySlug, families, lighting: lightingGuess } = response.result;
      if (families.length === 0) {
        setError("Couldn't pick out clear colors in that photo — try a closer, well-lit shot, or pick manually below.");
        return;
      }
      onExtracted(families);
      setAppliedCount(families.length);
      setSuggestedCategoryName(categories.find((c) => c.slug === categorySlug)?.name ?? null);
      if (lightingGuess === "actinic" || lightingGuess === "mixed") setLighting(lightingGuess);
    });
  }

  if (!open) {
    return (
      <button type="button" className="funnel-assist-toggle" onClick={() => setOpen(true)}>
        📷 Or upload a photo — we&apos;ll guess the colors for you
      </button>
    );
  }

  return (
    <div className="funnel-assist">
      <label htmlFor="funnel-assist-photo" className="funnel-assist-label">
        Upload a photo of your coral
      </label>
      <input
        id="funnel-assist-photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={pending}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {photoUrl ? (
        <button
          type="button"
          className="funnel-assist-preview-trigger"
          onClick={() => setLightboxOpen(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="Your uploaded coral photo" className="funnel-assist-preview" />
          <span className="funnel-assist-preview-hint">Tap to enlarge</span>
        </button>
      ) : null}
      {lightboxOpen && photoUrl ? (
        <PhotoLightbox src={photoUrl} onClose={() => setLightboxOpen(false)} />
      ) : null}
      {pending && <p className="muted funnel-assist-status">Looking at your photo…</p>}
      {error && <p className="error funnel-assist-status">{error}</p>}
      {!pending && !error && appliedCount > 0 && (
        <p className="funnel-assist-status funnel-assist-success">
          Set {appliedCount} color{appliedCount === 1 ? "" : "s"} below — tap any chip to adjust before
          matching.
          {suggestedCategoryName ? (
            <>
              {" "}
              We also think the shape might be <strong>{suggestedCategoryName}</strong> — shape guesses are
              less reliable, so tap it in Step 1 above yourself if that looks right.
            </>
          ) : null}
        </p>
      )}
      {lighting && <p className="muted funnel-assist-status">{LIGHTING_CAVEAT[lighting]}</p>}
    </div>
  );
}

// The guided "identify by the colors you see" funnel — the site's primary
// front door. A beginner picks the coral's rough shape (optional) and the
// colors they actually see, and gets a ranked shortlist of real registry
// entries to compare against. Anatomy/hex precision stays on the linked wiki
// page as a *confirmation* step; nothing here asks the user to know coral
// anatomy. All data arrives as props (server-fetched + colors binned
// server-side); scoring is a tiny pure function so it runs live client-side.
export function CoralIdentifyFunnel({
  corals,
  categories,
}: {
  corals: ColorMatchCoral[];
  categories: FunnelCategory[];
}) {
  const searchParams = useSearchParams();

  // Shape + colors are read from the URL on mount and kept in sync as they
  // change, so clicking through to a result's wiki page and hitting the
  // browser Back button restores the exact same picks instead of a blank
  // funnel. Sync uses the raw History API (not next/navigation's router),
  // deliberately — this page is force-dynamic, so router.replace/push would
  // re-run the page's server data fetches (corals, categories, the whole
  // community queue) on every single chip click. history.replaceState only
  // updates the address bar, no navigation, no re-fetch.
  const [category, setCategory] = useState<string | null>(() => searchParams.get("shape")); // slug, or null = any
  const [colors, setColors] = useState<ColorFamily[]>(() => {
    const raw = searchParams.get("colors");
    if (!raw) return [];
    const known = new Set(COLOR_FAMILIES.map((f) => f.code));
    return raw.split(",").filter((c): c is ColorFamily => known.has(c as ColorFamily));
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set("shape", category);
    if (colors.length > 0) params.set("colors", colors.join(","));
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/identify?${qs}` : "/identify");
  }, [category, colors]);

  const colorSet = useMemo(() => new Set(colors), [colors]);

  function toggleColor(f: ColorFamily) {
    setColors((prev) => (prev.includes(f) ? prev.filter((c) => c !== f) : [...prev, f]));
  }

  function applyExtracted(families: ColorFamily[]) {
    setColors(COLOR_FAMILIES.map((f) => f.code).filter((c) => families.includes(c)));
  }

  const ranked = useMemo(() => {
    if (colors.length === 0) return [];
    const inCategory = category
      ? corals.filter((c) => c.categorySlug === category)
      : corals;
    return inCategory
      .map((coral) => ({ coral, match: scoreCoralMatch(colors, coral.families) }))
      .filter((r) => r.match.score > 0)
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 8);
  }, [corals, category, colors]);

  const hasQuery = colors.length > 0;
  const categoryCount = category
    ? corals.filter((c) => c.categorySlug === category).length
    : corals.length;

  return (
    <div className="funnel">
      <PhotoTraitAssist categories={categories} onExtracted={applyExtracted} />

      {/* Step 1 — shape (optional) */}
      <div className="funnel-step">
        <div className="funnel-step-head">
          <span className="funnel-step-num">1</span>
          <div>
            <h2 className="funnel-step-title">What shape is it?</h2>
            <p className="funnel-step-hint">Optional — skip if you&apos;re not sure.</p>
          </div>
        </div>
        <div className="funnel-chips">
          <button
            type="button"
            className={`funnel-chip${category === null ? " selected" : ""}`}
            onClick={() => setCategory(null)}
          >
            Any / not sure
          </button>
          {categories.map((c) => (
            <button
              type="button"
              key={c.slug}
              className={`funnel-chip${category === c.slug ? " selected" : ""}`}
              onClick={() => setCategory(c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2 — colors */}
      <div className="funnel-step">
        <div className="funnel-step-head">
          <span className="funnel-step-num">2</span>
          <div>
            <h2 className="funnel-step-title">What colors do you see?</h2>
            <p className="funnel-step-hint">Tap every color that stands out. No coral-anatomy needed.</p>
          </div>
        </div>
        <div className="funnel-colors">
          {COLOR_FAMILIES.map((f) => {
            const on = colorSet.has(f.code);
            return (
              <button
                type="button"
                key={f.code}
                className={`funnel-color${on ? " selected" : ""}`}
                aria-pressed={on}
                onClick={() => toggleColor(f.code)}
              >
                <span className="funnel-color-dot" style={{ background: f.swatch }} />
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 3 — results */}
      {hasQuery && (
        <div className="funnel-step">
          <div className="funnel-step-head">
            <span className="funnel-step-num">3</span>
            <div>
              <h2 className="funnel-step-title">
                {ranked.length > 0
                  ? `${ranked.length} close ${ranked.length === 1 ? "match" : "matches"}`
                  : "No close matches yet"}
              </h2>
              <p className="funnel-step-hint">
                {ranked.length > 0
                  ? "Ranked by how well the colors line up. Open one to see its full reference photos and colors."
                  : `Nothing in ${category ? "this group" : "the registry"} has that exact color mix documented yet.`}
              </p>
            </div>
          </div>

          {ranked.length > 0 ? (
            <div className="funnel-results">
              {ranked.map(({ coral, match }) => (
                <a
                  key={coral.id}
                  className="funnel-result"
                  href={`/coral/${coral.genusSlug}/${coral.slug}`}
                >
                  <div className="funnel-result-photo">
                    {coral.heroUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coral.heroUrl} alt={`${coral.name} — reference photo`} />
                    ) : (
                      <div
                        className="funnel-result-tile"
                        style={{ background: tileBg(coral.hexes) }}
                      />
                    )}
                  </div>
                  <div className="funnel-result-body">
                    <div className="funnel-result-name">
                      {coral.name}
                      <span className="muted"> · {coral.genusName}</span>
                    </div>
                    <div className="funnel-result-families">
                      {coral.families.map((fam) => (
                        <span
                          key={fam}
                          className={`funnel-fam${colorSet.has(fam) ? " matched" : ""}`}
                          title={colorSet.has(fam) ? `${familyLabel(fam)} (you saw this)` : familyLabel(fam)}
                        >
                          <span className="funnel-fam-dot" style={{ background: SWATCH[fam] }} />
                          {familyLabel(fam)}
                        </span>
                      ))}
                    </div>
                    {match.missed.length > 0 && (
                      <p className="funnel-result-missed">
                        No {match.missed.map(familyLabel).join(", ").toLowerCase()} documented for this one
                      </p>
                    )}
                    <span className="funnel-result-cta">View full profile &amp; photos →</span>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="muted funnel-empty">
              Try removing a color, widening the shape to “Any”, or post a photo below for
              the community to weigh in.
            </p>
          )}

          <p className="funnel-fallback-line">
            {category ? `${categoryCount} corals in this group · ` : ""}
            Not seeing yours?{" "}
            <a href="#community">Post a photo for the community →</a>
          </p>
        </div>
      )}
    </div>
  );
}

function tileBg(hexes: string[]): string {
  if (hexes.length === 0) return "var(--panel)";
  if (hexes.length === 1) return hexes[0];
  return `linear-gradient(135deg, ${hexes.slice(0, 4).join(", ")})`;
}
