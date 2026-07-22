"use client";

// Konva touches window/document at import time, so this whole component
// tree has no SSR story. Whoever mounts TankMapCanvas on a server-rendered
// page (e.g. app/tank/[id]/page.tsx) MUST bring it in via next/dynamic with
// { ssr: false } — importing it directly from a Server Component will break
// the build. Example:
//   const TankMapCanvas = dynamic(
//     () => import("@/components/tank-map-canvas").then((m) => m.TankMapCanvas),
//     { ssr: false },
//   );

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Stage, Layer } from "react-konva";
import type Konva from "konva";
import { deleteMapTile, placeMapPin, removeMapPin, updateMapTile } from "@/app/tank/map-actions";
import { MapTile } from "@/components/map-tile";
import { TileUploadPanel } from "@/components/tile-upload-panel";
import { TileCropModal } from "@/components/tile-crop-modal";
import { MapTilePanel, type UnpinnedOption } from "@/components/map-tile-panel";
import type { MapPin, MapTile as MapTileData } from "@/lib/tank-map";
import type { SearchableMorph } from "@/lib/wiki";

type Genus = { id: string; name: string };

const STAGE_HEIGHT = 480;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// The full "arrange your tank's photo tiles + tag corals to them" surface —
// TankMapCanvas is the direct map analogue of TankGridInteractive
// (components/tank-grid-interactive.tsx) for the X/Y/Z grid: same idea of
// "click something on the visual, a panel opens below to act on it," just
// over a Konva canvas instead of a CSS grid.
//
// Deliberately holds NO local copy of tiles/pins (unlike an early draft of
// this file) — same convention as every other owner panel in this app
// (grid-slot-panel.tsx, tank-grid-interactive.tsx): a mutation calls its
// server action, then router.refresh() re-fetches tiles/pins as fresh props
// from the parent Server Component. Live drag/resize feedback comes from
// Konva itself moving its own node, not from React state — only the
// gesture's END result needs to reach React at all.
export function TankMapCanvas({
  tankId,
  tiles,
  pins,
  unpinned,
  morphs,
  genera,
}: {
  tankId: string;
  tiles: MapTileData[];
  pins: MapPin[];
  unpinned: UnpinnedOption[];
  morphs: SearchableMorph[];
  genera: Genus[];
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);

  const [stageWidth, setStageWidth] = useState(800);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setStageWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Deliberately no auto-fit/auto-center of any kind: pan/scale only ever
  // change from the owner's own wheel/drag/pinch gestures below. An earlier
  // attempt at fitting the view to the tiles' bounding box on mount still
  // read as "it recenters on me" in practice, so the view now stays exactly
  // wherever the owner left it, full stop.
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [croppingTileId, setCroppingTileId] = useState<string | null>(null);
  const [pinPanelTarget, setPinPanelTarget] = useState<{
    tileId: string;
    point: { x: number; y: number };
  } | null>(null);
  const [tileError, setTileError] = useState<string | null>(null);
  const [tilePending, setTilePending] = useState(false);
  const [cropSaving, setCropSaving] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);
  const [uploadCascade, setUploadCascade] = useState(0);

  const pinsByTile = useMemo(() => {
    const map = new Map<string, MapPin[]>();
    for (const pin of pins) {
      const list = map.get(pin.tileId) ?? [];
      list.push(pin);
      map.set(pin.tileId, list);
    }
    return map;
  }, [pins]);

  const sortedTiles = useMemo(() => [...tiles].sort((a, b) => a.zIndex - b.zIndex), [tiles]);
  const selectedTile = tiles.find((t) => t.id === selectedTileId) ?? null;
  const croppingTile = tiles.find((t) => t.id === croppingTileId) ?? null;

  function persistTransform(
    tileId: string,
    transform: { posX: number; posY: number; width: number; height: number; rotation: number },
  ) {
    const formData = new FormData();
    formData.set("tile_id", tileId);
    formData.set("pos_x", String(transform.posX));
    formData.set("pos_y", String(transform.posY));
    formData.set("width", String(transform.width));
    formData.set("height", String(transform.height));
    formData.set("rotation", String(transform.rotation));
    updateMapTile(formData).then((result) => {
      if (result?.error) setTileError(result.error);
      else router.refresh();
    });
  }

  function reorderSelected(direction: "front" | "back") {
    if (!selectedTile) return;
    const zIndex =
      direction === "front"
        ? Math.max(0, ...tiles.map((t) => t.zIndex)) + 1
        : Math.min(0, ...tiles.map((t) => t.zIndex)) - 1;
    const formData = new FormData();
    formData.set("tile_id", selectedTile.id);
    formData.set("z_index", String(zIndex));
    setTilePending(true);
    updateMapTile(formData).then((result) => {
      setTilePending(false);
      if (result?.error) setTileError(result.error);
      else router.refresh();
    });
  }

  function deleteSelected() {
    if (!selectedTile) return;
    if (!window.confirm("Delete this tile? Any coral pins on it will be removed too.")) return;
    const tileId = selectedTile.id;
    setTilePending(true);
    deleteMapTile(formDataWith({ tile_id: tileId })).then((result) => {
      setTilePending(false);
      if (result?.error) setTileError(result.error);
      setSelectedTileId(null);
      router.refresh();
    });
  }

  function handleSaveCrop(rect: { x: number; y: number; width: number; height: number }) {
    if (!croppingTile) return;
    setCropSaving(true);
    setCropError(null);
    const formData = new FormData();
    formData.set("tile_id", croppingTile.id);
    formData.set("crop_x", String(rect.x));
    formData.set("crop_y", String(rect.y));
    formData.set("crop_width", String(rect.width));
    formData.set("crop_height", String(rect.height));
    updateMapTile(formData).then((result) => {
      setCropSaving(false);
      if (result?.error) {
        setCropError(result.error);
        return;
      }
      setCroppingTileId(null);
      router.refresh();
    });
  }

  function handleRemovePin(coralId: string) {
    setSelectedPinId(null);
    removeMapPin(formDataWith({ coral_id: coralId })).then(() => router.refresh());
  }

  // Repositioning an existing pin re-uses placeMapPin: it upserts on
  // coral_id (see map-actions.ts), so calling it again with the same tile
  // and a new pos_x/pos_y just moves the existing row instead of adding one.
  function handleMovePin(tileId: string, pinId: string, point: { x: number; y: number }) {
    const pin = pins.find((p) => p.id === pinId);
    if (!pin) return;
    const formData = new FormData();
    formData.set("coral_id", pin.coralId);
    formData.set("tile_id", tileId);
    formData.set("pos_x", String(point.x));
    formData.set("pos_y", String(point.y));
    placeMapPin(formData).then((result) => {
      if (result?.error) setTileError(result.error);
      else router.refresh();
    });
  }

  // Click on genuinely empty canvas (no shape hit at all) deselects — a
  // click that lands on a tile is handled by that MapTile itself, which
  // calls handleTileEmptyClick below (it's the only place that knows the
  // tile's real natural image size, needed to convert the click into
  // crop-pixel space correctly; see map-tile.tsx's handleClick). A click on
  // a pin never reaches here either way — CoralPin cancels bubbling.
  function handleStageClick() {
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const shape = stage.getIntersection(pointer);
    if (!shape) {
      setSelectedTileId(null);
      setSelectedPinId(null);
    }
  }

  function handleTileEmptyClick(tileId: string, point: { x: number; y: number }) {
    setSelectedTileId(tileId);
    setPinPanelTarget({ tileId, point });
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldScale = scale;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = clamp(oldScale * (1 + direction * 0.08), MIN_SCALE, MAX_SCALE);
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };
    setScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }

  // Two-finger pinch-to-zoom for mobile/tablet — Konva has no built-in
  // gesture for this, so it's the standard manual recipe: track the
  // distance between the two touches and scale relative to its change.
  function handleTouchMove(e: Konva.KonvaEventObject<TouchEvent>) {
    const touches = e.evt.touches;
    if (touches.length !== 2) return;
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const p1 = { x: touches[0].clientX, y: touches[0].clientY };
    const p2 = { x: touches[1].clientX, y: touches[1].clientY };
    const dist = distance(p1, p2);
    if (!pinchRef.current) {
      pinchRef.current = { distance: dist, scale };
      return;
    }
    const newScale = clamp((pinchRef.current.scale * dist) / pinchRef.current.distance, MIN_SCALE, MAX_SCALE);
    setScale(newScale);
  }

  function handleTouchEnd() {
    pinchRef.current = null;
  }

  return (
    <div>
      <div className="form-actions" style={{ marginBottom: "0.6rem" }}>
        <TileUploadPanel
          tankId={tankId}
          tileCount={tiles.length}
          cascadeOffset={uploadCascade}
          onUploaded={() => setUploadCascade((n) => n + 1)}
        />
        {selectedTile ? (
          <>
            <button type="button" className="btn-secondary" onClick={() => setCroppingTileId(selectedTile.id)}>
              Crop
            </button>
            <button type="button" className="btn-secondary" disabled={tilePending} onClick={() => reorderSelected("front")}>
              Bring to front
            </button>
            <button type="button" className="btn-secondary" disabled={tilePending} onClick={() => reorderSelected("back")}>
              Send to back
            </button>
            <button type="button" className="btn-secondary" disabled={tilePending} onClick={deleteSelected}>
              Delete tile
            </button>
          </>
        ) : null}
      </div>
      {tileError ? <p className="error">{tileError}</p> : null}

      <div ref={containerRef} className="card" style={{ padding: 0, overflow: "hidden", touchAction: "none" }}>
        <Stage
          ref={stageRef}
          width={stageWidth}
          height={STAGE_HEIGHT}
          scaleX={scale}
          scaleY={scale}
          x={stagePos.x}
          y={stagePos.y}
          draggable
          onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
          onClick={handleStageClick}
          onTap={handleStageClick}
          onWheel={handleWheel}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Layer>
            {sortedTiles.map((tile) => (
              <MapTile
                key={tile.id}
                tile={tile}
                pins={pinsByTile.get(tile.id) ?? []}
                selected={tile.id === selectedTileId}
                selectedPinId={selectedPinId}
                onSelect={() => {
                  setSelectedTileId(tile.id);
                  setPinPanelTarget(null);
                }}
                onEmptyClick={(point) => handleTileEmptyClick(tile.id, point)}
                onTransformEnd={(t) => persistTransform(tile.id, t)}
                onSelectPin={setSelectedPinId}
                onOpenPin={(pinId) => router.push(`/specimen/${pins.find((p) => p.id === pinId)?.coralId}`)}
                onMovePin={(pinId, point) => handleMovePin(tile.id, pinId, point)}
              />
            ))}
          </Layer>
        </Stage>
      </div>

      {selectedPinId
        ? (() => {
            const pin = pins.find((p) => p.id === selectedPinId);
            if (!pin) return null;
            return (
              <div className="card" style={{ marginTop: "0.6rem" }}>
                <div className="form-actions" style={{ marginTop: 0, alignItems: "center" }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{pin.label || pin.taxonName || "Unnamed coral"}</p>
                  <button type="button" className="btn-secondary" onClick={() => router.push(`/specimen/${pin.coralId}`)}>
                    View
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => handleRemovePin(pin.coralId)}>
                    Remove pin
                  </button>
                </div>
              </div>
            );
          })()
        : null}

      {pinPanelTarget ? (
        <div style={{ marginTop: "0.6rem" }}>
          <MapTilePanel
            tileId={pinPanelTarget.tileId}
            point={pinPanelTarget.point}
            tankId={tankId}
            unpinned={unpinned}
            morphs={morphs}
            genera={genera}
            onClose={() => setPinPanelTarget(null)}
          />
        </div>
      ) : null}

      {croppingTile ? (
        <TileCropModal
          key={croppingTile.id}
          tile={croppingTile}
          saving={cropSaving}
          error={cropError}
          onSave={handleSaveCrop}
          onClose={() => {
            setCroppingTileId(null);
            setCropError(null);
          }}
        />
      ) : null}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// FormData isn't constructible from a plain object directly — this tiny
// helper is just that conversion, used for the one-field payloads
// (delete/remove actions) that don't warrant building up a FormData inline.
function formDataWith(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}
