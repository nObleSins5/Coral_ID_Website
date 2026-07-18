"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  COLOR_FAMILIES,
  familyLabel,
  scoreCoralMatch,
  type ColorFamily,
} from "@/lib/color-match";
import type { ColorMatchCoral, FunnelCategory, IdentifyShowcaseData } from "@/lib/wiki";
import { extractCoralTraitsFromPhoto } from "@/app/identify/vision-actions";
import { uploadUnidentifiedPhoto } from "@/app/identify/actions";
import { createClient } from "@/lib/supabase/client";
import { resolveTemplateCode, stepsForTemplate, type AnatomyStep } from "@/lib/anatomy-steps";
import {
  CATEGORY_CHARACTERISTICS,
  GENUS_CHARACTERISTICS,
  PATTERN_CHARACTERISTICS,
} from "@/lib/coral-characteristics";
import { CharacteristicsPopup } from "@/components/characteristics-popup";
import { ColorPercentSplit, type StepColorPick } from "@/components/color-percent-split";
import { ColorSwatch } from "@/components/coral-ui";

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

const PATTERN_LABEL: Record<string, string> = {
  spotted: "Spotted",
  mottled: "Mottled",
  banded: "Banded",
  tipped: "Tipped",
  ringed: "Ringed",
  rainbow: "Rainbow blocks",
};
const PATTERN_CODES = Object.keys(PATTERN_LABEL);

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lighting, setLighting] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);
  const [suggestedCategoryName, setSuggestedCategoryName] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [posting, startPosting] = useTransition();
  const [postError, setPostError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Object URLs are memory-held by the browser until revoked — clean up the
  // previous one whenever a new photo replaces it, and on unmount.
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setLighting(null);
    setSuggestedCategoryName(null);
    setPhotoUrl(URL.createObjectURL(file));
    setPhotoFile(file);
    setPosted(false);
    setPostError(null);
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

  // The photo stays local/ephemeral by default (never uploaded just for the
  // AI-assist analysis above — same contract as before). This is a distinct,
  // explicit action: reuses the already-selected file so a user who didn't
  // get a confident match doesn't have to re-pick the same photo down in the
  // community section — same upload path as that section's own form
  // (uploadUnidentifiedPhoto), so it appears in the queue immediately.
  function postToCommunity() {
    if (!photoFile) return;
    setPostError(null);
    const formData = new FormData();
    formData.set("photo", photoFile);
    startPosting(async () => {
      const result = await uploadUnidentifiedPhoto(formData);
      if (result?.error) {
        setPostError(result.error);
        return;
      }
      setPosted(true);
      router.refresh();
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
              We also think the type might be <strong>{suggestedCategoryName}</strong> — type guesses are
              less reliable, so tap it in Step 1 above yourself if that looks right.
            </>
          ) : null}
        </p>
      )}
      {lighting && <p className="muted funnel-assist-status">{LIGHTING_CAVEAT[lighting]}</p>}

      {photoFile && !posted ? (
        <div className="funnel-assist-community">
          {userId ? (
            <button type="button" className="btn-secondary" disabled={posting} onClick={postToCommunity}>
              {posting ? "Posting…" : "Not finding it? Post this photo for the community →"}
            </button>
          ) : (
            <p className="muted funnel-assist-status">
              <a href="/login">Log in</a> to post this same photo for the community to help identify.
            </p>
          )}
          {postError && <p className="error funnel-assist-status">{postError}</p>}
        </div>
      ) : null}
      {posted ? (
        <p className="funnel-assist-status funnel-assist-success">
          Posted — your photo is live in <a href="#community">the community queue</a> below.
        </p>
      ) : null}
    </div>
  );
}

function InfoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="funnel-info-btn"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`What does ${label} look like?`}
      title={`What does ${label} look like?`}
    >
      ⓘ
    </button>
  );
}

// A selectable pill plus an "ⓘ" info trigger — two sibling <button>s inside a
// plain <div>, not one nested inside the other (nesting interactive elements
// is invalid HTML and was causing a real hydration mismatch — caught live
// while verifying this change against the dev server).
function ChipWithInfo({
  label,
  selected,
  onSelect,
  onInfo,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  onInfo: () => void;
}) {
  return (
    <div className={`funnel-chip${selected ? " selected" : ""}`}>
      <button type="button" className="funnel-chip-select" onClick={onSelect}>
        {label}
      </button>
      <InfoButton label={label} onClick={onInfo} />
    </div>
  );
}

// --- URL encoding for the anatomy step picks --------------------------------
// Compact, non-JSON so the address bar stays readable; restores the exact
// funnel state on browser Back the same way the original flat `colors` param
// did. Uses history.replaceState (not next/navigation's router) — this route
// is force-dynamic, so a router-driven update would re-run the whole page's
// server fetches on every chip tap.
function encodeSteps(stepColors: Record<string, StepColorPick[]>): string {
  return Object.entries(stepColors)
    .filter(([, picks]) => picks.length > 0)
    .map(([key, picks]) => `${key}:${picks.map((p) => `${p.family}.${p.percent}`).join(",")}`)
    .join(";");
}
function decodeSteps(raw: string | null): Record<string, StepColorPick[]> {
  if (!raw) return {};
  const known = new Set(COLOR_FAMILIES.map((f) => f.code));
  const out: Record<string, StepColorPick[]> = {};
  for (const part of raw.split(";")) {
    const [key, picksRaw] = part.split(":");
    if (!key || !picksRaw) continue;
    const picks: StepColorPick[] = [];
    for (const p of picksRaw.split(",")) {
      const [fam, pctRaw] = p.split(".");
      if (!known.has(fam as ColorFamily)) continue;
      const pct = Number(pctRaw);
      picks.push({ family: fam as ColorFamily, percent: Number.isFinite(pct) ? pct : 100 });
    }
    if (picks.length > 0) out[key] = picks;
  }
  return out;
}

function evenSplit(picks: StepColorPick[]): StepColorPick[] {
  const n = picks.length;
  if (n === 0) return picks;
  const even = Math.round(100 / n / 10) * 10;
  return picks.map((p, i) => ({ ...p, percent: i === n - 1 ? 100 - even * (n - 1) : even }));
}

// The guided "identify by the colors you see" funnel — the site's primary
// front door. A beginner picks the coral's rough type (optional), its genus
// if they know it (optional), then works through the specific spots on that
// kind of coral (mouth/skirt/tentacles on a zoa, growth tip/skin on an SPS,
// etc — see lib/anatomy-steps.ts) noting colors and roughly how much of
// each, plus any pattern they notice. Anatomy/hex precision stays on the
// linked wiki page as a *confirmation* step; nothing here requires the user
// to already know coral anatomy — every step past the colors themselves is
// optional. All data arrives as props (server-fetched + colors binned
// server-side); scoring is a tiny pure function so it runs live client-side.
export function CoralIdentifyFunnel({
  corals,
  categories,
  showcase,
}: {
  corals: ColorMatchCoral[];
  categories: FunnelCategory[];
  showcase: IdentifyShowcaseData;
}) {
  const searchParams = useSearchParams();

  const [category, setCategory] = useState<string | null>(() => searchParams.get("shape"));
  const [genusSlug, setGenusSlug] = useState<string | null>(() => searchParams.get("genus"));
  const [stepColors, setStepColors] = useState<Record<string, StepColorPick[]>>(() =>
    decodeSteps(searchParams.get("steps")),
  );
  const [skippedOptional, setSkippedOptional] = useState<Set<string>>(() => {
    const raw = searchParams.get("skip");
    return new Set(raw ? raw.split(",") : []);
  });
  const [patterns, setPatterns] = useState<string[]>(() => {
    const raw = searchParams.get("patterns");
    return raw ? raw.split(",").filter((p) => PATTERN_CODES.includes(p)) : [];
  });
  const [openPopup, setOpenPopup] = useState<
    { kind: "category"; slug: string } | { kind: "genus"; slug: string } | { kind: "pattern"; code: string } | null
  >(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set("shape", category);
    if (genusSlug) params.set("genus", genusSlug);
    const stepsQs = encodeSteps(stepColors);
    if (stepsQs) params.set("steps", stepsQs);
    if (skippedOptional.size > 0) params.set("skip", [...skippedOptional].join(","));
    if (patterns.length > 0) params.set("patterns", patterns.join(","));
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/identify?${qs}` : "/identify");
  }, [category, genusSlug, stepColors, skippedOptional, patterns]);

  const selectedCategory = categories.find((c) => c.slug === category) ?? null;
  const genusList = selectedCategory?.genera ?? [];
  const selectedGenus = genusList.find((g) => g.slug === genusSlug) ?? null;
  const templateCode = resolveTemplateCode(category, selectedGenus?.anatomyTemplateCode);
  const steps = stepsForTemplate(templateCode);
  // The fallback flat-color step (rendered when no type/genus is picked, so
  // `steps` is empty) still counts as exactly one step for numbering.
  const colorStepCount = steps.length > 0 ? steps.length : 1;

  // A different kind of coral has entirely different anatomy positions —
  // stale picks from a zoa's "Skirt" step have no meaning once the template
  // switches to an SPS, so reset when the template itself changes.
  const prevTemplateRef = useRef(templateCode);
  useEffect(() => {
    if (prevTemplateRef.current !== templateCode) {
      setStepColors({});
      setSkippedOptional(new Set());
      prevTemplateRef.current = templateCode;
    }
  }, [templateCode]);

  function selectCategory(slug: string | null) {
    setCategory(slug);
    setGenusSlug(null);
  }

  function toggleStepColor(stepKey: string, family: ColorFamily) {
    setStepColors((prev) => {
      const current = prev[stepKey] ?? [];
      const exists = current.some((p) => p.family === family);
      const next = exists ? current.filter((p) => p.family !== family) : [...current, { family, percent: 0 }];
      return { ...prev, [stepKey]: evenSplit(next) };
    });
  }

  function setStepPicks(stepKey: string, picks: StepColorPick[]) {
    setStepColors((prev) => ({ ...prev, [stepKey]: picks }));
  }

  function toggleSkipStep(stepKey: string) {
    setSkippedOptional((prev) => {
      const next = new Set(prev);
      if (next.has(stepKey)) next.delete(stepKey);
      else next.add(stepKey);
      return next;
    });
    setStepColors((prev) => ({ ...prev, [stepKey]: [] }));
  }

  function togglePattern(code: string) {
    setPatterns((prev) => (prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]));
  }

  function applyExtracted(families: ColorFamily[]) {
    // AI-guessed colors land in the first step of the current template (or
    // stay unattached if no type/genus is picked yet) — still fully editable,
    // same "suggestion, not a verdict" contract as before.
    const firstStep = steps[0];
    if (!firstStep) return;
    setStepColors((prev) => ({
      ...prev,
      [firstStep.key]: evenSplit(families.map((family) => ({ family, percent: 0 }))),
    }));
  }

  const flatColors = useMemo(() => {
    const seen = new Set<ColorFamily>();
    const out: ColorFamily[] = [];
    for (const picks of Object.values(stepColors)) {
      for (const p of picks) {
        if (!seen.has(p.family)) {
          seen.add(p.family);
          out.push(p.family);
        }
      }
    }
    return out;
  }, [stepColors]);

  const dominantPick = useMemo(() => {
    let best: StepColorPick | null = null;
    for (const picks of Object.values(stepColors)) {
      for (const p of picks) {
        if (!best || p.percent > best.percent) best = p;
      }
    }
    return best;
  }, [stepColors]);

  const ranked = useMemo(() => {
    if (flatColors.length === 0) return [];
    let inScope = category ? corals.filter((c) => c.categorySlug === category) : corals;
    if (genusSlug) inScope = inScope.filter((c) => c.genusSlug === genusSlug);
    return inScope
      .map((coral) => ({
        coral,
        match: scoreCoralMatch(flatColors, coral.families, {
          userDominantFamily: dominantPick?.family ?? null,
          coralDominantFamily: coral.dominantFamily,
          userPatterns: patterns,
          coralPatterns: coral.patterns,
        }),
      }))
      .filter((r) => r.match.score > 0)
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 8);
  }, [corals, category, genusSlug, flatColors, dominantPick, patterns]);

  const hasQuery = flatColors.length > 0;
  const scopeCount = (() => {
    let inScope = category ? corals.filter((c) => c.categorySlug === category) : corals;
    if (genusSlug) inScope = inScope.filter((c) => c.genusSlug === genusSlug);
    return inScope.length;
  })();
  const colorSet = useMemo(() => new Set(flatColors), [flatColors]);

  return (
    <div className="funnel">
      <PhotoTraitAssist categories={categories} onExtracted={applyExtracted} />

      {/* Step 1 — type (optional) */}
      <div className="funnel-step">
        <div className="funnel-step-head">
          <span className="funnel-step-num">1</span>
          <div>
            <h2 className="funnel-step-title">What type is it?</h2>
            <p className="funnel-step-hint">Optional — skip if you&apos;re not sure.</p>
          </div>
        </div>
        <div className="funnel-chips">
          <button
            type="button"
            className={`funnel-chip${category === null ? " selected" : ""}`}
            onClick={() => selectCategory(null)}
          >
            Any / not sure
          </button>
          {categories.map((c) => (
            <ChipWithInfo
              key={c.slug}
              label={c.name}
              selected={category === c.slug}
              onSelect={() => selectCategory(c.slug)}
              onInfo={() => setOpenPopup({ kind: "category", slug: c.slug })}
            />
          ))}
        </div>
      </div>

      {/* Step 2 — genus (optional, only once a type is picked) */}
      {selectedCategory && genusList.length > 0 ? (
        <div className="funnel-step">
          <div className="funnel-step-head">
            <span className="funnel-step-num">2</span>
            <div>
              <h2 className="funnel-step-title">Which genus, if you know it?</h2>
              <p className="funnel-step-hint">Optional — narrows the results further.</p>
            </div>
          </div>
          <div className="funnel-chips">
            <button
              type="button"
              className={`funnel-chip${genusSlug === null ? " selected" : ""}`}
              onClick={() => setGenusSlug(null)}
            >
              Any genus
            </button>
            {genusList.map((g) => (
              <ChipWithInfo
                key={g.slug}
                label={g.name}
                selected={genusSlug === g.slug}
                onSelect={() => setGenusSlug(g.slug)}
                onInfo={() => setOpenPopup({ kind: "genus", slug: g.slug })}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Step 3 — anatomy-aware color step-through */}
      {steps.length > 0 ? (
        <div className="funnel-anatomy">
          <div className="funnel-anatomy-nav">
            {steps.map((step) => {
              const done = skippedOptional.has(step.key) || (stepColors[step.key]?.length ?? 0) > 0;
              return (
                <a key={step.key} href={`#funnel-anatomy-step-${step.key}`} className={`funnel-nav-item${done ? " done" : ""}`}>
                  <span className="funnel-nav-dot" />
                  {step.label}
                </a>
              );
            })}
          </div>
          <div className="funnel-anatomy-steps">
            {steps.map((step, i) => (
              <AnatomyColorStep
                key={step.key}
                step={step}
                num={i + 3}
                picks={stepColors[step.key] ?? []}
                skipped={skippedOptional.has(step.key)}
                onToggleColor={(f) => toggleStepColor(step.key, f)}
                onSetPicks={(picks) => setStepPicks(step.key, picks)}
                onToggleSkip={() => toggleSkipStep(step.key)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="funnel-step">
          <div className="funnel-step-head">
            <span className="funnel-step-num">3</span>
            <div>
              <h2 className="funnel-step-title">What colors do you see?</h2>
              <p className="funnel-step-hint">
                Pick a type above (or any genus) to get body-part-specific steps — or just tap colors here.
              </p>
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
                  onClick={() => toggleStepColor("__general", f.code)}
                >
                  <span className="funnel-color-dot" style={{ background: f.swatch }} />
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step — patterns (optional) */}
      <div className="funnel-step">
        <div className="funnel-step-head">
          <span className="funnel-step-num">{colorStepCount + 3}</span>
          <div>
            <h2 className="funnel-step-title">Any patterns you notice?</h2>
            <p className="funnel-step-hint">Optional — nudges the ranking, never filters results.</p>
          </div>
        </div>
        <div className="funnel-chips">
          {PATTERN_CODES.map((code) => (
            <ChipWithInfo
              key={code}
              label={PATTERN_LABEL[code]}
              selected={patterns.includes(code)}
              onSelect={() => togglePattern(code)}
              onInfo={() => setOpenPopup({ kind: "pattern", code })}
            />
          ))}
        </div>
      </div>

      {/* Results */}
      {hasQuery && (
        <div className="funnel-step">
          <div className="funnel-step-head">
            <span className="funnel-step-num">{colorStepCount + 4}</span>
            <div>
              <h2 className="funnel-step-title">
                {ranked.length > 0
                  ? `${ranked.length} close ${ranked.length === 1 ? "match" : "matches"}`
                  : "No close matches yet"}
              </h2>
              <p className="funnel-step-hint">
                {ranked.length > 0
                  ? "Ranked by how well the colors line up. Open one to see its full reference photos and colors."
                  : `Nothing in ${genusSlug ? "this genus" : category ? "this type" : "the registry"} has that exact color mix documented yet.`}
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
              Try removing a color, widening the type to “Any”, or post a photo below for
              the community to weigh in.
            </p>
          )}

          <p className="funnel-fallback-line">
            {category ? `${scopeCount} corals in this group · ` : ""}
            Not seeing yours?{" "}
            <a href="#community">Post a photo for the community →</a>
          </p>
        </div>
      )}

      {openPopup?.kind === "category" ? (
        (() => {
          const c = categories.find((cc) => cc.slug === openPopup.slug);
          const content = c ? CATEGORY_CHARACTERISTICS[c.slug] : null;
          if (!c || !content) return null;
          return (
            <CharacteristicsPopup
              title={c.name}
              summary={content.summary}
              traits={content.traits}
              photos={showcase.categoryPhotos[c.slug] ?? []}
              onClose={() => setOpenPopup(null)}
            />
          );
        })()
      ) : null}

      {openPopup?.kind === "genus" ? (
        (() => {
          const g = genusList.find((gg) => gg.slug === openPopup.slug);
          const content = g ? GENUS_CHARACTERISTICS[g.slug] : null;
          if (!g || !content) return null;
          // Only this genus's own real photos — falling back to the wider
          // category's photos showed the wrong genus (e.g. Montipora's
          // popup showing an Acropora photo), reported live. Everything
          // else falls back to illustrative art via PhotoCarousel.
          return (
            <CharacteristicsPopup
              title={g.name}
              summary={content.summary}
              traits={content.traits}
              photos={showcase.genusPhotos[g.slug] ?? []}
              onClose={() => setOpenPopup(null)}
            />
          );
        })()
      ) : null}

      {openPopup?.kind === "pattern" ? (
        (() => {
          const content = PATTERN_CHARACTERISTICS[openPopup.code];
          if (!content) return null;
          const example = showcase.patternExamples[openPopup.code];
          const hexes = example?.hexes && example.hexes.length > 0 ? example.hexes : content.examplePair;
          return (
            <CharacteristicsPopup
              title={PATTERN_LABEL[openPopup.code]}
              summary={content.summary}
              traits={[]}
              media={
                <div className="pattern-popup-media">
                  <div className="carousel-fallback pattern-popup-swatch">
                    <ColorSwatch
                      range={{
                        position_label: null,
                        color_pattern_code: openPopup.code,
                        label: null,
                        approx_percent: null,
                        color_stops: hexes.map((hex, ordinal) => ({ hex, ordinal })),
                      }}
                      title={PATTERN_LABEL[openPopup.code]}
                    />
                    <span className="carousel-fallback-label muted">
                      {example ? `Illustrative — ${example.name}'s documented colors` : "Illustrative example"}
                    </span>
                  </div>
                  {example ? (
                    // Opens in a new tab — clicking through to the wiki page
                    // must never risk losing funnel progress in the
                    // original tab (reported live: it felt like progress
                    // was lost when the link replaced the current page).
                    <a
                      className="pattern-popup-link"
                      href={`/coral/${example.genusSlug}/${example.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Real example: {example.name} ↗
                    </a>
                  ) : (
                    <p className="muted">No real coral in the registry documents this pattern yet — placeholder shown above.</p>
                  )}
                </div>
              }
              onClose={() => setOpenPopup(null)}
            />
          );
        })()
      ) : null}
    </div>
  );
}

function AnatomyColorStep({
  step,
  num,
  picks,
  skipped,
  onToggleColor,
  onSetPicks,
  onToggleSkip,
}: {
  step: AnatomyStep;
  num: number;
  picks: StepColorPick[];
  skipped: boolean;
  onToggleColor: (family: ColorFamily) => void;
  onSetPicks: (picks: StepColorPick[]) => void;
  onToggleSkip: () => void;
}) {
  const pickedSet = new Set(picks.map((p) => p.family));
  return (
    <div className="funnel-step" id={`funnel-anatomy-step-${step.key}`}>
      <div className="funnel-step-head">
        <span className="funnel-step-num">{num}</span>
        <div>
          <h2 className="funnel-step-title">What colors do you see on the {step.label.toLowerCase()}?</h2>
          {step.optional ? (
            <p className="funnel-step-hint">Optional — not every coral has this part.</p>
          ) : null}
        </div>
      </div>
      {step.optional ? (
        <button type="button" className={`funnel-skip-toggle${skipped ? " active" : ""}`} onClick={onToggleSkip}>
          {skipped ? `✓ Not on this coral` : `Not on this coral?`}
        </button>
      ) : null}
      {!skipped && (
        <>
          <div className="funnel-colors">
            {COLOR_FAMILIES.map((f) => {
              const on = pickedSet.has(f.code);
              return (
                <button
                  type="button"
                  key={f.code}
                  className={`funnel-color${on ? " selected" : ""}`}
                  aria-pressed={on}
                  onClick={() => onToggleColor(f.code)}
                >
                  <span className="funnel-color-dot" style={{ background: f.swatch }} />
                  {f.label}
                </button>
              );
            })}
          </div>
          <ColorPercentSplit picks={picks} onChange={onSetPicks} />
        </>
      )}
    </div>
  );
}

function tileBg(hexes: string[]): string {
  if (hexes.length === 0) return "var(--panel)";
  if (hexes.length === 1) return hexes[0];
  return `linear-gradient(135deg, ${hexes.slice(0, 4).join(", ")})`;
}
