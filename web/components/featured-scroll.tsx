"use client";

import type { CSSProperties } from "react";
import { CareDifficultyPill } from "@/components/coral-ui";
import type { FeaturedMorph } from "@/lib/wiki";

// A slow, continuous auto-scroll through up to 20 featured photos, one row
// tall — replaces the old fixed 4-up grid, which spilled a 5th card onto its
// own half-empty second row at common viewport widths. The track is the
// morph list rendered twice back-to-back with a CSS keyframe animation that
// scrolls exactly one copy's width, so the loop is seamless; hovering (or
// focusing a card, for keyboard users) pauses it so a photo can actually be
// read/clicked.
export function FeaturedScroll({ morphs }: { morphs: FeaturedMorph[] }) {
  // Scales with the photo count so the per-photo pace stays roughly constant
  // (slow enough to actually look at each one) whether there are 5 or 20.
  const durationSeconds = Math.max(30, morphs.length * 6);

  return (
    <div className="featured-scroll">
      <div
        className="featured-scroll-track"
        style={{ "--featured-scroll-duration": `${durationSeconds}s` } as CSSProperties}
      >
        {[morphs, morphs].map((copy, copyIndex) => (
          <div className="featured-scroll-set" key={copyIndex} aria-hidden={copyIndex === 1}>
            {copy.map((m) => (
              <a
                key={`${copyIndex}-${m.id}`}
                className="featured-card"
                href={`/coral/${m.genusSlug}/${m.slug}`}
                tabIndex={copyIndex === 1 ? -1 : undefined}
              >
                <div className="featured-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.heroUrl} alt={`${m.name} — community photo`} />
                </div>
                <div className="featured-card-meta">
                  <span className="name">{m.name}</span>
                  <span className="muted">{m.genusName}</span>
                  <CareDifficultyPill code={m.care_difficulty_code} />
                </div>
              </a>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
