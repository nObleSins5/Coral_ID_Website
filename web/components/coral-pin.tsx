"use client";

import { Circle, Group, Text } from "react-konva";
import type Konva from "konva";
import { MAP_COLORS, type MapPin } from "@/lib/tank-map";

// A small marker rendered as a child of its owning tile's Konva Group (see
// MapTile) — inheriting the tile's position/rotation/scale for free means a
// pin never needs recalculating when its tile moves (36_tank_map.sql's
// tile-relative pin coordinates). counterScaleX/Y undo the PARENT group's
// scale so the dot stays a constant screen size even if the tile has been
// stretched non-uniformly by a resize.
export function CoralPin({
  pin,
  x,
  y,
  counterScaleX,
  counterScaleY,
  selected,
  onSelect,
  onOpen,
  onMove,
}: {
  pin: MapPin;
  x: number;
  y: number;
  counterScaleX: number;
  counterScaleY: number;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  // Fired at the end of a pin drag with the new position in the SAME space
  // as x/y above (the tile's display space, pre counter-scale) — the caller
  // converts to crop-pixel space and persists it, same as initial placement.
  onMove: (pos: { x: number; y: number }) => void;
}) {
  function handleTap(e: Konva.KonvaEventObject<Event>) {
    e.cancelBubble = true;
    onSelect();
  }

  function handleDragStart(e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
    onSelect();
  }

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
    onMove({ x: e.target.x(), y: e.target.y() });
  }

  return (
    <Group
      x={x}
      y={y}
      scaleX={counterScaleX}
      scaleY={counterScaleY}
      draggable
      onTap={handleTap}
      onClick={handleTap}
      onDblTap={onOpen}
      onDblClick={onOpen}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Konva's hitFunc is a Shape-level API, not available on Group — a
          bigger-than-visible, fully transparent Circle is the standard way
          to grow a touch target: Konva's hit graph is drawn from a shape's
          geometry regardless of opacity, so this registers taps within a
          14px radius while staying invisible in the normal render. */}
      <Circle radius={14} fill="black" opacity={0} />
      {selected ? <Circle radius={11} fill={MAP_COLORS.accent} opacity={0.35} /> : null}
      <Circle radius={7} fill={MAP_COLORS.accent} stroke={MAP_COLORS.accentInk} strokeWidth={1.5} />
      {selected ? (
        <Text
          text={pin.label || pin.taxonName || "Unnamed coral"}
          x={12}
          y={-8}
          fontSize={12}
          fontFamily="Roboto, system-ui, sans-serif"
          fill={MAP_COLORS.accentInk}
          padding={4}
        />
      ) : null}
    </Group>
  );
}
