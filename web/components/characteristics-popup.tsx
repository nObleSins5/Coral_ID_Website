"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { PhotoCarousel, type CarouselPhoto } from "@/components/photo-carousel";

// Reuses the same modal-overlay/modal-panel/Escape/focus-trap contract as
// coral-identify-funnel.tsx's PhotoLightbox — the app's one existing
// enlarge/overlay pattern.
export function CharacteristicsPopup({
  title,
  summary,
  traits,
  photos,
  media,
  onClose,
}: {
  title: string;
  summary: string;
  traits: string[];
  photos?: CarouselPhoto[];
  // Overrides the photo carousel with arbitrary content — used by the
  // pattern-recognition popup, which illustrates via ColorSwatch (a real
  // coral example when one exists in the registry) rather than a photo grid.
  media?: ReactNode;
  onClose: () => void;
}) {
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
        className="modal-panel characteristics-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id={titleId} style={{ margin: 0 }}>
            {title}
          </h3>
          <button type="button" ref={closeRef} className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="characteristics-summary">{summary}</p>
        <ul className="characteristics-traits">
          {traits.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        {media ?? <PhotoCarousel photos={photos ?? []} fallbackSeed={title} />}
      </div>
    </div>
  );
}
