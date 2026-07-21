"use client";

import { useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from "react-konva";
import type Konva from "konva";
import { useHTMLImage } from "@/components/map-tile";
import { MAP_COLORS, type MapTile } from "@/lib/tank-map";

const MAX_MODAL_DIMENSION = 480;

// A dedicated, unrotated, natural-pixel-space crop editor — deliberately
// separate from the live canvas tile (see map-tile.tsx's top comment) so
// dragging the crop box is simple 1:1 pixel math, not entangled with the
// tile's own rotation/placement transform. Non-destructive: editing the crop
// never re-uploads the source image, only updates tank_map_tiles.crop_*
// (36_tank_map.sql) — so a user can nudge it back and forth while aligning
// against a neighboring tile's overlap without losing the original photo.
export function TileCropModal({
  tile,
  onSave,
  onClose,
  saving,
  error,
}: {
  tile: MapTile;
  onSave: (rect: { x: number; y: number; width: number; height: number }) => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [image] = useHTMLImage(tile.publicUrl);
  const rectRef = useRef<Konva.Rect>(null);
  // Caller remounts this component with key={tile.id} on tile switch (see
  // TankMapCanvas), so this only ever needs its OWN prior state reset via a
  // fresh mount — no resync-on-prop-change effect needed. null = "no crop
  // set yet, default to the full natural image," resolved at render time
  // below rather than baked into state up front, since the natural image
  // size isn't known until `image` finishes loading.
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(
    tile.cropWidth != null && tile.cropHeight != null
      ? { x: tile.cropX, y: tile.cropY, width: tile.cropWidth, height: tile.cropHeight }
      : null,
  );

  const naturalWidth = image?.naturalWidth ?? tile.width;
  const naturalHeight = image?.naturalHeight ?? tile.height;
  const effectiveRect = rect ?? { x: 0, y: 0, width: naturalWidth, height: naturalHeight };
  // Fit the (potentially large) source photo inside the modal — the crop
  // box's on-screen size is scaled down, but every value it reports back is
  // converted to true source-pixel space before onSave is called.
  const displayScale = Math.min(1, MAX_MODAL_DIMENSION / Math.max(naturalWidth, naturalHeight));

  function handleTransformerRef(node: Konva.Transformer | null) {
    if (node && rectRef.current) node.nodes([rectRef.current]);
  }

  function handleRectChange() {
    const node = rectRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    setRect({
      x: clamp(node.x(), 0, naturalWidth) / displayScale,
      y: clamp(node.y(), 0, naturalHeight) / displayScale,
      width: clamp((node.width() * scaleX) / displayScale, 20, naturalWidth),
      height: clamp((node.height() * scaleY) / displayScale, 20, naturalHeight),
    });
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel modal-panel-wide">
        <div className="grid-slot-panel-header">
          <p style={{ margin: 0, fontWeight: 600 }}>Crop tile</p>
          <button type="button" className="btn-secondary" onClick={onClose} style={{ marginTop: 0 }}>
            Close
          </button>
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
          Drag the box to the exact spot where this tile overlaps its neighbor, to keep the seam
          minimal. You can always come back and adjust it later.
        </p>
        {image ? (
          <Stage width={naturalWidth * displayScale} height={naturalHeight * displayScale}>
            <Layer>
              <KonvaImage
                image={image}
                width={naturalWidth * displayScale}
                height={naturalHeight * displayScale}
              />
              <Rect
                ref={rectRef}
                x={effectiveRect.x * displayScale}
                y={effectiveRect.y * displayScale}
                width={effectiveRect.width * displayScale}
                height={effectiveRect.height * displayScale}
                stroke={MAP_COLORS.accent}
                strokeWidth={2}
                dash={[6, 4]}
                fill="rgba(112, 214, 255, 0.15)"
                draggable
                dragBoundFunc={(pos) => ({
                  x: clamp(pos.x, 0, naturalWidth * displayScale - effectiveRect.width * displayScale),
                  y: clamp(pos.y, 0, naturalHeight * displayScale - effectiveRect.height * displayScale),
                })}
                onDragEnd={handleRectChange}
                onTransformEnd={handleRectChange}
              />
              <Transformer
                ref={handleTransformerRef}
                rotateEnabled={false}
                flipEnabled={false}
                anchorSize={14}
                anchorCornerRadius={7}
                borderStroke={MAP_COLORS.accent}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 20 || newBox.height < 20) return oldBox;
                  return newBox;
                }}
              />
            </Layer>
          </Stage>
        ) : (
          <p className="muted">Loading photo…</p>
        )}
        <div className="form-actions">
          <button type="button" disabled={saving || !image} onClick={() => onSave(effectiveRect)}>
            {saving ? "Saving…" : "Save crop"}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
