"use client";

import { useEffect, useState } from "react";
import type { ColorRange } from "@/components/coral-ui";
import { ColorSwatch } from "@/components/coral-ui";

export type CarouselPhoto = { url: string; alt: string };

// No real photo licensing/sourcing is available for most of this content
// (the live DB has only a handful of community photos) — real photos fill
// slots first (best-voted, passed in already ordered by the caller), and any
// remaining slots up to `slots` get an illustrative color-tile "photo" built
// from the same seeded-pattern approach ColorSwatch already uses, so it's
// consistent with the app's existing visual language rather than new art
// infrastructure. Never fake/hotlinked photography.
function fallbackSwatch(seed: string, index: number): ColorRange {
  const hexes = FALLBACK_HEX_SETS[(hashSeed(seed) + index) % FALLBACK_HEX_SETS.length];
  return {
    position_label: null,
    color_pattern_code: "rainbow",
    label: null,
    approx_percent: null,
    color_stops: hexes.map((hex, ordinal) => ({ hex, ordinal })),
  };
}

const FALLBACK_HEX_SETS: string[][] = [
  ["#2E8B57", "#F28C00"],
  ["#1E90FF", "#FFF3D6"],
  ["#800080", "#FF69B4"],
  ["#E23B3B", "#5B7A3A"],
  ["#8B4513", "#FFD700"],
];

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function PhotoCarousel({
  photos,
  fallbackSeed,
  slots = 5,
}: {
  photos: CarouselPhoto[];
  fallbackSeed: string;
  slots?: number;
}) {
  const [index, setIndex] = useState(0);
  const shown = photos.slice(0, slots);
  const fallbackCount = Math.max(0, slots - shown.length);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + slots) % slots);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % slots);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [slots]);

  if (slots === 0) return null;

  const isRealPhoto = index < shown.length;

  return (
    <div className="carousel">
      {/* Arrows are absolutely positioned over the stage, not laid out in a
          flex row beside the image — a flex row here previously let a wide
          or oddly-sized image push the "next" arrow outside the card
          (reported live). An overlay can never be pushed off regardless of
          image size. */}
      <div className="carousel-stage">
        {isRealPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown[index].url} alt={shown[index].alt} className="carousel-img" />
        ) : (
          <div className="carousel-fallback" title="Illustrative example — no real photo yet">
            <ColorSwatch range={fallbackSwatch(fallbackSeed, index - shown.length)} title="Illustrative example" />
            <span className="carousel-fallback-label muted">Illustrative example</span>
          </div>
        )}
        <button
          type="button"
          className="carousel-arrow carousel-arrow-prev"
          onClick={() => setIndex((i) => (i - 1 + slots) % slots)}
          aria-label="Previous photo"
        >
          ‹
        </button>
        <button
          type="button"
          className="carousel-arrow carousel-arrow-next"
          onClick={() => setIndex((i) => (i + 1) % slots)}
          aria-label="Next photo"
        >
          ›
        </button>
      </div>
      <div className="carousel-dots" role="tablist" aria-label="Photo slides">
        {Array.from({ length: slots }).map((_, i) => (
          <button
            type="button"
            key={i}
            className={`carousel-dot${i === index ? " active" : ""}`}
            onClick={() => setIndex(i)}
            aria-label={`Show photo ${i + 1}`}
            aria-selected={i === index}
            role="tab"
          />
        ))}
      </div>
      {fallbackCount > 0 && shown.length > 0 ? (
        <p className="muted carousel-note">
          {shown.length} real photo{shown.length === 1 ? "" : "s"} so far — the rest are illustrative examples.
        </p>
      ) : null}
    </div>
  );
}
