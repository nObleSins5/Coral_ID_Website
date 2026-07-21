"use client";

import { useEffect, useRef, useState } from "react";
import { Group, Image as KonvaImage, Rect, Transformer } from "react-konva";
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
  selectedPinId,
  onSelect,
  onEmptyClick,
  onTransformEnd,
  onSelectPin,
  onOpenPin,
}: {
  tile: MapTileData;
  pins: MapPin[];
  selected: boolean;
  selectedPinId: string | null;
  onSelect: () => void;
  // Fired (alongside onSelect) with the click point already converted to
  // crop-pixel space — see the displayScaleX/Y comment below for why this
  // conversion has to happen HERE rather than in the caller: only MapTile
  // knows the tile's actual loaded natural image size.
  onEmptyClick: (point: { x: number; y: number }) => void;
  onTransformEnd: (transform: {
    posX: number;
    posY: number;
    width: number;
    height: number;
    rotation: number;
  }) => void;
  onSelectPin: (pinId: string) => void;
  onOpenPin: (pinId: string) => void;
}) {
  const [image] = useHTMLImage(tile.publicUrl);
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const naturalWidth = image?.naturalWidth ?? tile.width;
  const naturalHeight = image?.naturalHeight ?? tile.height;
  const cropWidth = tile.cropWidth ?? naturalWidth;
  const cropHeight = tile.cropHeight ?? naturalHeight;

  useEffect(() => {
    if (selected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selected]);

  function handleTransformEnd() {
    const node = groupRef.current;
    if (!node) return;
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
    onTransformEnd({
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
  function handleClick() {
    onSelect();
    const point = groupRef.current?.getRelativePointerPosition();
    if (!point) return;
    onEmptyClick({ x: point.x / displayScaleX, y: point.y / displayScaleY });
  }

  return (
    <>
      <Group
        ref={groupRef}
        id={tile.id}
        x={tile.posX}
        y={tile.posY}
        rotation={tile.rotation}
        draggable
        onClick={handleClick}
        onTap={handleClick}
        onDragEnd={handleTransformEnd}
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
          />
        ))}
      </Group>
      {selected ? (
        <Transformer
          ref={transformerRef}
          rotateEnabled
          flipEnabled={false}
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
          anchorSize={16}
          anchorCornerRadius={8}
          borderStroke={MAP_COLORS.accent}
        />
      ) : null}
    </>
  );
}
