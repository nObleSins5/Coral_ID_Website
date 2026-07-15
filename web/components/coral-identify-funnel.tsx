"use client";

import { useMemo, useState } from "react";
import {
  COLOR_FAMILIES,
  familyLabel,
  scoreCoralMatch,
  type ColorFamily,
} from "@/lib/color-match";
import type { ColorMatchCoral, FunnelCategory } from "@/lib/wiki";

const SWATCH: Record<ColorFamily, string> = Object.fromEntries(
  COLOR_FAMILIES.map((f) => [f.code, f.swatch]),
) as Record<ColorFamily, string>;

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
  const [category, setCategory] = useState<string | null>(null); // slug, or null = any
  const [colors, setColors] = useState<ColorFamily[]>([]);

  const colorSet = useMemo(() => new Set(colors), [colors]);

  function toggleColor(f: ColorFamily) {
    setColors((prev) => (prev.includes(f) ? prev.filter((c) => c !== f) : [...prev, f]));
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
                  ? "Ranked by how well the colors line up. Open one to compare it side by side."
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
                    <span className="funnel-result-cta">Compare &amp; confirm →</span>
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
