"use client";

import { useEffect, useRef, useState } from "react";
import { Group, Image as KonvaImage, Rect } from "react-konva";
import type Konva from "konva";
import { MAP_COLORS, type MapPin, type MapTile as MapTileData } from "@/lib/tank-map";
import { CoralPin } from "@/components/coral-pin";

// Cropping is intentionally NOT handled inline here — a tile on the canvas
// can be rotated/repositioned, and overlaying a crop-rect on a rotated,
// non-1:1-scaled tile makes the crop math (and the UX of "what pixel am I
// actually selecting") needlessly confusing. See TileCropModal
// (components/tile-crop-modal.tsx): a dedicated, unrotated, natural-size
// view of just the source photo, opened via the toolbar's "Crop" button
// when a tile is selected.

// No SSR, no shared cache needed here — each MapTile mounts its own tile
// image once. Deliberately NOT the `use-image` npm package (not otherwise
// used in this project) to avoid a dependency for a ~10-line load. Only sets
// state from the async onload/onerror callbacks (the sanctioned "subscribe
// to an external system" effect shape) — never synchronously in the effect
// body itself.
export function useHTMLImage(url: string): [HTMLImageElement | null] {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = url;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  return [image];
}

export function MapTile({
  tile,
  pins,
  selected,
  isGroupSelection,
  selectedPinId,
  onSelect,
  onDoubleClick,
  onEmptyClick,
  onDragEnd,
  onGroupDragMove,
  onGroupDragEnd,
  onSelectPin,
  onOpenPin,
  onMovePin,
  onNodeRef,
}: {
  tile: MapTileData;
  pins: MapPin[];
  // True whenever this tile is part of the current selection — a lone
  // ungrouped tile, an ad-hoc shift-click multi-select, or a saved group.
  // The Transformer that actually draws the selection handles/highlight
  // lives one level up now (TankMapCanvas), because Konva's Transformer
  // natively supports attaching to several nodes at once and transforming
  // them together — see tank-map-canvas.tsx's handleGroupTransformEnd.
  selected: boolean;
  // True when the ACTIVE selection has 2+ tiles in it (whether or not
  // they're a saved group yet) — this tile's own drag handler uses it to
  // decide whether to drag solo (today's original behavior) or propagate
  // the drag delta to the rest of the selection (see onGroupDragMove/End).
  isGroupSelection: boolean;
  selectedPinId: string | null;
  // shiftKey=true means "toggle me into/out of the multi-select" rather
  // than "replace the selection with me" — see handleClick below.
  onSelect: (opts: { shiftKey: boolean }) => void;
  // Double-click "enters" a group to select just this one tile, so its
  // individual Crop/Delete/resize toolbar actions apply to only it.
  onDoubleClick: () => void;
  // Fired (alongside onSelect) with the click point already converted to
  // crop-pixel space — see the displayScaleX/Y comment below for why this
  // conversion has to happen HERE rather than in the caller: only MapTile
  // knows the tile's actual loaded natural image size. Skipped on a
  // shift-click (that's a selection gesture, not a "tag a coral here" one).
  onEmptyClick: (point: { x: number; y: number }) => void;
  // Solo drag/resize/rotate end (isGroupSelection false) — same per-tile
  // bake-in this always did. Group transforms are instead read directly off
  // every member node by the shared Transformer in the parent.
  onDragEnd: (transform: {
    posX: number;
    posY: number;
    width: number;
    height: number;
    rotation: number;
  }) => void;
  // Live sibling-follow while dragging one tile of a multi-tile selection.
  onGroupDragMove: (delta: { x: number; y: number }) => void;
  onGroupDragEnd: (delta: { x: number; y: number }) => void;
  onSelectPin: (pinId: string) => void;
  onOpenPin: (pinId: string) => void;
  // Fired at the end of a pin drag with its new position already converted
  // to crop-pixel space, same convention as onEmptyClick above.
  onMovePin: (pinId: string, point: { x: number; y: number }) => void;
  // Reports this tile's live Konva node up to the parent, which keeps a
  // tileId -> node map so the shared Transformer and group-drag math can
  // reach every selected tile's node directly. Called with null on unmount.
  onNodeRef: (node: Konva.Group | null) => void;
}) {
  const [image] = useHTMLImage(tile.publicUrl);
  const groupRef = useRef<Konva.Group>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Tiles keep their full original photo resolution (only the on-canvas
  // display width/height is scaled down at upload time, see
  // tile-upload-panel.tsx's DEFAULT_TILE_MAX_DIMENSION). Left uncached,
  // Konva has to rescale that full-res source image on every single
  // drag/transform frame, which is what made dragging/resizing feel laggy.
  // Caching rasterizes the group to a bitmap for the duration of the
  // gesture so Konva just blits pixels instead of rescaling the source.
  function cacheNode() {
    groupRef.current?.cache();
  }
  function clearNodeCache() {
    groupRef.current?.clearCache();
  }

  const naturalWidth = image?.naturalWidth ?? tile.width;
  const naturalHeight = image?.naturalHeight ?? tile.height;
  const cropWidth = tile.cropWidth ?? naturalWidth;
  const cropHeight = tile.cropHeight ?? naturalHeight;

  function handleDragStart() {
    cacheNode();
    dragStartRef.current = { x: tile.posX, y: tile.posY };
  }

  function handleDragMove() {
    const node = groupRef.current;
    const start = dragStartRef.current;
    if (!node || !start || !isGroupSelection) return;
    onGroupDragMove({ x: node.x() - start.x, y: node.y() - start.y });
  }

  function handleDragEnd() {
    const node = groupRef.current;
    clearNodeCache();
    if (!node) return;
    if (isGroupSelection) {
      const start = dragStartRef.current;
      dragStartRef.current = null;
      if (!start) return;
      onGroupDragEnd({ x: node.x() - start.x, y: node.y() - start.y });
      return;
    }
    onDragEnd({ posX: node.x(), posY: node.y(), width: tile.width, height: tile.height, rotation: tile.rotation });
  }

  // Solo resize/rotate only — group transforms are read off every member
  // node directly by the parent's shared Transformer, never through here.
  function handleTransformEnd() {
    const node = groupRef.current;
    if (!node) return;
    clearNodeCache();
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const newWidth = Math.max(20, tile.width * scaleX);
    const newHeight = Math.max(20, tile.height * scaleY);
    // Standard Konva pattern: bake the transformer's scale into width/height
    // and reset the node's own scale to 1, so scale never compounds across
    // repeated resizes (and so pins' displayScale math below — tile.width /
    // cropWidth — stays a simple ratio, not scale-on-scale).
    node.scaleX(1);
    node.scaleY(1);
    onDragEnd({
      posX: node.x(),
      posY: node.y(),
      width: newWidth,
      height: newHeight,
      rotation: node.rotation(),
    });
  }

  // Pins are stored relative to the tile's CROP (source-pixel space, see
  // 36_tank_map.sql). The Group below is positioned/rotated but not scaled;
  // the Image inside it stretches the crop to (tile.width, tile.height) via
  // explicit width/height rather than a node scale — so a pin's local
  // position is just its stored coords scaled by the same width/cropWidth
  // ratio the image itself was stretched by.
  const displayScaleX = tile.width / cropWidth;
  const displayScaleY = tile.height / cropHeight;

  // A click lands here (not on a pin — CoralPin cancels bubbling) whenever
  // the tile's own image/background is clicked. getRelativePointerPosition
  // on the Group returns the pointer in the Group's own local space (already
  // accounting for the tile's position/rotation), so dividing by the same
  // displayScaleX/Y the image itself was stretched by converts it straight
  // into crop-pixel space — the same space pins are stored in.
  function handleClick(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const shiftKey = "shiftKey" in e.evt && e.evt.shiftKey;
    onSelect({ shiftKey });
    if (shiftKey) return;
    const point = groupRef.current?.getRelativePointerPosition();
    if (!point) return;
    onEmptyClick({ x: point.x / displayScaleX, y: point.y / displayScaleY });
  }

  return (
    <Group
      ref={(node) => {
        groupRef.current = node;
        onNodeRef(node);
      }}
      id={tile.id}
      x={tile.posX}
      y={tile.posY}
      rotation={tile.rotation}
      draggable
      onClick={handleClick}
      onTap={handleClick}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onTransformStart={cacheNode}
      onTransformEnd={handleTransformEnd}
    >
      {image ? (
        <KonvaImage
          image={image}
          crop={{ x: tile.cropX, y: tile.cropY, width: cropWidth, height: cropHeight }}
          width={tile.width}
          height={tile.height}
          stroke={selected ? MAP_COLORS.accent : undefined}
          strokeWidth={selected ? 3 : 0}
        />
      ) : (
        <Rect width={tile.width} height={tile.height} fill={MAP_COLORS.border} />
      )}
      {pins.map((pin) => (
        <CoralPin
          key={pin.id}
          pin={pin}
          x={pin.posX * displayScaleX}
          y={pin.posY * displayScaleY}
          counterScaleX={1}
          counterScaleY={1}
          selected={pin.id === selectedPinId}
          onSelect={() => onSelectPin(pin.id)}
          onOpen={() => onOpenPin(pin.id)}
          onMove={(pos) => onMovePin(pin.id, { x: pos.x / displayScaleX, y: pos.y / displayScaleY })}
        />
      ))}
    </Group>
  );
}
