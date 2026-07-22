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
import { Stage, Layer, Transformer } from "react-konva";
import type Konva from "konva";
import {
  deleteMapTile,
  groupTiles,
  placeMapPin,
  removeMapPin,
  ungroupTiles,
  updateMapTile,
} from "@/app/tank/map-actions";
import { MapTile } from "@/components/map-tile";
import { TileUploadPanel } from "@/components/tile-upload-panel";
import { TileCropModal } from "@/components/tile-crop-modal";
import { MapTilePanel, type UnpinnedOption } from "@/components/map-tile-panel";
import { MAP_COLORS, type MapPin, type MapTile as MapTileData } from "@/lib/tank-map";
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
  // The active multi-select — built by shift-clicking tiles, or auto-filled
  // to a whole saved group's members on a plain click of any one of them
  // (see handleTileSelect). soloEditTileId overrides this: double-clicking
  // a tile "enters" it for individual editing even if it's part of a group,
  // per the owner's spec ("click once = group, double-click = individual
  // tile"). tileNodesRef mirrors every mounted tile's live Konva node so
  // the shared groupTransformerRef and the group-drag math below can reach
  // any selected tile directly, without going through React state/re-render.
  const [selectedTileIds, setSelectedTileIds] = useState<string[]>([]);
  const [soloEditTileId, setSoloEditTileId] = useState<string | null>(null);
  const tileNodesRef = useRef<Map<string, Konva.Group>>(new Map());
  const groupTransformerRef = useRef<Konva.Transformer>(null);
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
  const croppingTile = tiles.find((t) => t.id === croppingTileId) ?? null;

  // soloEditTileId (double-click) always wins over the ad-hoc/group
  // multi-select — see the type comment above selectedTileIds.
  const activeSelectionIds = soloEditTileId ? [soloEditTileId] : selectedTileIds;
  const isGroupSelection = activeSelectionIds.length > 1;
  const soloTile = activeSelectionIds.length === 1 ? tiles.find((t) => t.id === activeSelectionIds[0]) ?? null : null;

  // The active selection is exactly one already-saved group (not a partial
  // subset, not an ad-hoc mix of ungrouped tiles) — this is what "Ungroup"
  // requires, and what disqualifies "Group" (nothing new to lock together).
  const savedGroupId = (() => {
    if (soloEditTileId || selectedTileIds.length < 2) return null;
    const selected = tiles.filter((t) => selectedTileIds.includes(t.id));
    if (selected.length !== selectedTileIds.length) return null;
    const gid = selected[0].tileGroupId;
    if (!gid || !selected.every((t) => t.tileGroupId === gid)) return null;
    const allMembers = tiles.filter((t) => t.tileGroupId === gid);
    return allMembers.length === selected.length ? gid : null;
  })();
  const canGroup = !soloEditTileId && selectedTileIds.length >= 2 && !savedGroupId;
  const canUngroup = savedGroupId != null;

  // Keeps the shared Transformer attached to exactly the currently-selected
  // tiles' live Konva nodes. A single node behaves exactly like the old
  // per-tile Transformer did; 2+ nodes get Konva's native multi-node
  // transform (each node ends up with its own correctly baked
  // position/scale/rotation, orbiting the group's shared bounding box) —
  // see handleSoloOrMemberTransformEnd below for why that means no extra
  // "combined bounding box" math is needed here at all.
  useEffect(() => {
    const transformer = groupTransformerRef.current;
    if (!transformer) return;
    const nodes = activeSelectionIds.map((id) => tileNodesRef.current.get(id)).filter((n): n is Konva.Group => !!n);
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [activeSelectionIds, tiles]);

  function persistTransformAsync(
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
    return updateMapTile(formData);
  }

  // Solo drag/resize/rotate end, AND each individual group member's
  // resize/rotate end (Konva's multi-node Transformer still fires its own
  // transformend on every node it transforms, already carrying that node's
  // correct final baked state — see map-tile.tsx's handleTransformEnd) —
  // one tile, one persist call, either way.
  function persistTransform(
    tileId: string,
    transform: { posX: number; posY: number; width: number; height: number; rotation: number },
  ) {
    persistTransformAsync(tileId, transform).then((result) => {
      if (result?.error) setTileError(result.error);
      else router.refresh();
    });
  }

  // Plain dragging (no resize/rotate) is NOT covered by the Transformer —
  // only the one tile actually grabbed moves on its own, so when it's part
  // of a multi-tile selection we mirror its delta onto every sibling node
  // directly (bypassing React state for a smooth live drag), then persist
  // all of them together at the end.
  function handleGroupDragMove(delta: { x: number; y: number }) {
    for (const id of activeSelectionIds) {
      const node = tileNodesRef.current.get(id);
      const tile = tiles.find((t) => t.id === id);
      if (!node || !tile) continue;
      node.position({ x: tile.posX + delta.x, y: tile.posY + delta.y });
    }
    stageRef.current?.batchDraw();
  }

  function handleGroupDragEnd(delta: { x: number; y: number }) {
    const updates = activeSelectionIds
      .map((id) => tiles.find((t) => t.id === id))
      .filter((t): t is MapTileData => !!t)
      .map((t) => ({ tileId: t.id, posX: t.posX + delta.x, posY: t.posY + delta.y, width: t.width, height: t.height, rotation: t.rotation }));
    setTilePending(true);
    Promise.all(updates.map((u) => persistTransformAsync(u.tileId, u))).then((results) => {
      setTilePending(false);
      const failed = results.find((r) => r?.error);
      if (failed?.error) setTileError(failed.error);
      router.refresh();
    });
  }

  // Konva's Transformer fires its OWN transformend (before it fires on each
  // attached node — see map-tile.tsx's handleTransformEnd) whenever a
  // resize/rotate anchor is released, whether 1 or many nodes are
  // attached. For 2+ nodes this is the ONE place that reads every member's
  // resulting scale/position and persists the whole group in a single
  // batched call + refresh — each node firing its own redundant persist
  // afterward is exactly what was producing a cascade of network
  // round-trips (and the resulting lag/flicker) on a group resize. For a
  // solo tile (1 node), that node's own handler in map-tile.tsx already
  // does the persist, so this is a no-op here.
  function handleGroupTransformEnd() {
    const transformer = groupTransformerRef.current;
    if (!transformer) return;
    const nodes = transformer.nodes() as Konva.Group[];
    if (nodes.length < 2) return;
    const updates = nodes.map((node) => {
      const id = node.id();
      const tile = tiles.find((t) => t.id === id);
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const newWidth = Math.max(20, (tile?.width ?? node.width()) * scaleX);
      const newHeight = Math.max(20, (tile?.height ?? node.height()) * scaleY);
      return { tileId: id, posX: node.x(), posY: node.y(), width: newWidth, height: newHeight, rotation: node.rotation() };
    });
    setTilePending(true);
    Promise.all(updates.map((u) => persistTransformAsync(u.tileId, u))).then((results) => {
      setTilePending(false);
      const failed = results.find((r) => r?.error);
      if (failed?.error) setTileError(failed.error);
      router.refresh();
    });
  }

  function handleGroup() {
    setTilePending(true);
    groupTiles(formDataWith({ tile_ids: selectedTileIds.join(",") })).then((result) => {
      setTilePending(false);
      if (result?.error) setTileError(result.error);
      else router.refresh();
    });
  }

  function handleUngroup() {
    setTilePending(true);
    ungroupTiles(formDataWith({ tile_ids: selectedTileIds.join(",") })).then((result) => {
      setTilePending(false);
      if (result?.error) setTileError(result.error);
      else router.refresh();
    });
  }

  function reorderSelected(direction: "front" | "back") {
    if (!soloTile) return;
    const zIndex =
      direction === "front"
        ? Math.max(0, ...tiles.map((t) => t.zIndex)) + 1
        : Math.min(0, ...tiles.map((t) => t.zIndex)) - 1;
    const formData = new FormData();
    formData.set("tile_id", soloTile.id);
    formData.set("z_index", String(zIndex));
    setTilePending(true);
    updateMapTile(formData).then((result) => {
      setTilePending(false);
      if (result?.error) setTileError(result.error);
      else router.refresh();
    });
  }

  function deleteSelected() {
    if (!soloTile) return;
    if (!window.confirm("Delete this tile? Any coral pins on it will be removed too.")) return;
    const tileId = soloTile.id;
    setTilePending(true);
    deleteMapTile(formDataWith({ tile_id: tileId })).then((result) => {
      setTilePending(false);
      if (result?.error) setTileError(result.error);
      setSelectedTileIds([]);
      setSoloEditTileId(null);
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
  // calls handleTileSelect/handleTileEmptyClick below (it's the only place
  // that knows the tile's real natural image size, needed to convert the
  // click into crop-pixel space correctly; see map-tile.tsx's handleClick).
  // A click on a pin never reaches here either way — CoralPin cancels
  // bubbling.
  function handleStageClick() {
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const shape = stage.getIntersection(pointer);
    if (!shape) {
      setSelectedTileIds([]);
      setSoloEditTileId(null);
      setSelectedPinId(null);
    }
  }

  // Plain click replaces the selection: a grouped tile pulls in its whole
  // group (spec: "a single click selects the whole group"); an ungrouped
  // tile selects just itself. Shift-click instead toggles just that one
  // tile into/out of the selection, for building an ad-hoc multi-select to
  // hand to "Group" — it never expands to that tile's existing group, and
  // it skips the "add a coral here" flow below (that's a placement gesture,
  // not a selection one).
  function handleTileSelect(tile: MapTileData, opts: { shiftKey: boolean }) {
    setSoloEditTileId(null);
    if (opts.shiftKey) {
      setSelectedTileIds((prev) => (prev.includes(tile.id) ? prev.filter((id) => id !== tile.id) : [...prev, tile.id]));
      setPinPanelTarget(null);
      return;
    }
    setSelectedTileIds(tile.tileGroupId ? tiles.filter((t) => t.tileGroupId === tile.tileGroupId).map((t) => t.id) : [tile.id]);
  }

  function handleTileDoubleClick(tileId: string) {
    setSoloEditTileId(tileId);
    setSelectedTileIds([tileId]);
    setPinPanelTarget(null);
  }

  function handleTileEmptyClick(tileId: string, point: { x: number; y: number }) {
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
    // 0.08/tick made a single trackpad gesture (which fires many small wheel
    // events in a row) blow past a fine target zoom level almost instantly.
    // 0.02 gives roughly a 4x finer step for the same gesture.
    const newScale = clamp(oldScale * (1 + direction * 0.02), MIN_SCALE, MAX_SCALE);
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
        {soloTile ? (
          <>
            <button type="button" className="btn-secondary" onClick={() => setCroppingTileId(soloTile.id)}>
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
        {canGroup ? (
          <button type="button" className="btn-secondary" disabled={tilePending} onClick={handleGroup}>
            Group
          </button>
        ) : null}
        {canUngroup ? (
          <button type="button" className="btn-secondary" disabled={tilePending} onClick={handleUngroup}>
            Ungroup
          </button>
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
                selected={activeSelectionIds.includes(tile.id)}
                isGroupSelection={isGroupSelection && activeSelectionIds.includes(tile.id)}
                selectedPinId={selectedPinId}
                onSelect={(opts) => handleTileSelect(tile, opts)}
                onDoubleClick={() => handleTileDoubleClick(tile.id)}
                onEmptyClick={(point) => handleTileEmptyClick(tile.id, point)}
                onDragEnd={(t) => persistTransform(tile.id, t)}
                onGroupDragMove={handleGroupDragMove}
                onGroupDragEnd={handleGroupDragEnd}
                onSelectPin={setSelectedPinId}
                onOpenPin={(pinId) => router.push(`/specimen/${pins.find((p) => p.id === pinId)?.coralId}`)}
                onMovePin={(pinId, point) => handleMovePin(tile.id, pinId, point)}
                onNodeRef={(node) => {
                  if (node) tileNodesRef.current.set(tile.id, node);
                  else tileNodesRef.current.delete(tile.id);
                }}
              />
            ))}
            <Transformer
              ref={groupTransformerRef}
              rotateEnabled
              flipEnabled={false}
              enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
              anchorSize={16}
              anchorCornerRadius={8}
              borderStroke={MAP_COLORS.accent}
              onTransformEnd={handleGroupTransformEnd}
            />
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
