"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadMapTile } from "@/app/tank/map-actions";
import { MAX_MAP_TILES } from "@/lib/tank-map";

const DEFAULT_TILE_MAX_DIMENSION = 320; // starting on-canvas size; user resizes after

// Reads the file's natural pixel dimensions client-side (a plain
// createObjectURL + Image load, no library) so the tile lands on the canvas
// at a sensible default aspect ratio/size instead of a fixed square — the
// user still drags/resizes/rotates it afterward (see MapTile).
function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

// Reuses the same upload conventions as AddPhotoForm (components/add-photo-
// form.tsx) — same accepted mime types, same "collapsed button -> form"
// pattern — but targets tank_map_tiles instead of coral_photos.
export function TileUploadPanel({
  tankId,
  tileCount,
  cascadeOffset,
  onUploaded,
}: {
  tankId: string;
  tileCount: number;
  // A small per-upload offset so several tiles added in a row don't land
  // exactly stacked on top of each other; caller just passes an
  // incrementing counter.
  cascadeOffset: number;
  onUploaded?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const atCap = tileCount >= MAX_MAP_TILES;

  function handleSubmit(formData: FormData) {
    setError(null);
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose an image to upload.");
      return;
    }
    startTransition(async () => {
      let dims: { width: number; height: number };
      try {
        dims = await readImageDimensions(file);
      } catch {
        setError("Could not read that image.");
        return;
      }
      const scale = Math.min(1, DEFAULT_TILE_MAX_DIMENSION / Math.max(dims.width, dims.height));
      formData.set("tank_id", tankId);
      formData.set("width", String(Math.round(dims.width * scale)));
      formData.set("height", String(Math.round(dims.height * scale)));
      formData.set("pos_x", String(40 + (cascadeOffset % 6) * 24));
      formData.set("pos_y", String(40 + (cascadeOffset % 6) * 24));

      const result = await uploadMapTile(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onUploaded?.();
      router.refresh();
    });
  }

  if (atCap) {
    return (
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        This tank has {MAX_MAP_TILES} tiles, the current max.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}>
        Upload a tile
      </button>
    );
  }

  return (
    <form className="add-photo-form" action={handleSubmit}>
      <label htmlFor="map-tile-photo">Section photo</label>
      <input
        id="map-tile-photo"
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required
      />
      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
