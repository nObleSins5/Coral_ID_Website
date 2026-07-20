# Design Brief — Tank Scale Model (Calibrated Photo Placement)

*Shaped 2026-07-20. Supersedes the flat `grid_slots` abstraction as the
long-term placement model. Decisions confirmed in discovery are folded in
below; this is the v1 spec, with explicit phase-2 seams called out.*

## 1. Feature Summary

Replace the abstract column × row × tier **grid** (`grid_slots`, `TankMockup`)
with a **calibrated photo of the user's actual tank** that specimens are placed
onto at real-world coordinates. The user photographs their tank in a
constrained way, tells us the tank's known physical dimensions, and we derive an
inch-accurate coordinate system over the photo. Specimens are then dropped as
pins at real `(x, y, z)` positions — left/right, up/down, and front/back depth —
instead of snapping to a cell.

This is the feature the current grid was always a placeholder for
(`tank-grid-view.tsx`: *"A future pass may replace the rockwork with a real
per-tank layout"*). It is a **differentiator**: a flat tank photo alone can't
zoom into a dense rock outcrop and keep spatial meaning; a calibrated scene can.

### What this explicitly is NOT (scope guard)

- **Not** an orbitable 3D reconstruction / photogrammetry / gaussian splat.
  Reef tanks are a near-worst-case capture subject (moving water, refraction,
  glare, repetitive texture) and users can't reliably shoot the many angles
  photogrammetry needs. We deliver a *coordinate system + zoomable photo canvas
  + a linked depth view*, which reads as "a scale model you can manipulate"
  without pretending to be a rotatable mesh.
- **Not** auto-detection of corals from the photo. The **user taps** each
  specimen onto the canvas (confirmed). ML coral detection is a much-later
  possibility, out of scope.

## 2. Primary User Action

Look at a photo of *my own tank*, tap where each coral actually sits, and later
glance at that scene to know exactly what is where — including telling apart four
colonies clustered on one rock that a grid cell could never separate.

## 3. The Capture Model (confirmed: face-on + side profile)

The physics insight that makes cheap capture work: **the front glass is a flat
plane, so a phone slid flat along it captures a near-parallel projection.**
Because we know the tank's real dimensions, two glass-parallel sweeps fully
constrain 3D position without any true 3D reconstruction.

| Photo | Slides along | Calibrates | Role |
|---|---|---|---|
| **Face-on** (required, v1) | front glass | X (left–right), Y (up–down) | The primary canvas that replaces the grid drawing. |
| **Side profile** (required, v1) | side glass | Z (front–back depth), Y (cross-check) | The linked depth view; the measurement standard for how far off the front glass a structure sits. |
| Top-down (deferred, optional) | — | X/Z footprint cross-check | Often physically uncapturable (tank in a stand under a tight light). Never required; a future cross-check only. |

### Calibration math (v1, deliberately linear)

- Face-on: user marks the two known references (glass edges / frame corners) at
  a known real width → pixels-per-inch for X, and with the flat-against-glass
  plane, Y from the known height. A single 2D homography, not two separate axes.
- Side profile: front glass = depth 0, back glass = known depth `D`. An object's
  edge pixels map linearly to inches-from-front-glass (the "rock appears at pixel
  500, disappears at pixel 2000 → 5in off front, 6in off back" reasoning). 1D
  linear interpolation, no homography needed if the sweep stays glass-parallel.
- **Refraction is ignored in v1** (documented known error: ~5–10% depth error on
  far-back objects). This is aquascape placement, not lab metrology. Do not add
  refraction correction without a real accuracy complaint driving it.

## 4. Data Model (fork decisions: a / a / a / b)

### Decision record

1. **Migration = coexist, opt-in.** The scale-model tables are added *alongside*
   `grid_slots`; existing tanks and their placed specimens are untouched. A tank
   opts into the photo model. `grid_slots` is retired only once the new model is
   proven — not in this pass.
2. **Placement = continuous inch-coordinates.** A placed specimen stores real
   `(x, y, z)` in inches within a scene, not a cell reference. The one-specimen-
   per-cell uniqueness constraint does **not** apply here.
3. **Nested scenes = phase 2.** v1 ships a single calibrated scene per tank.
   The schema is shaped so a scene can later have a `parent_scene_id` + anchor
   point without a rewrite (see §7).
4. **Capture = face-on + side profile** (both required for v1 so depth is real
   from day one).

### Proposed tables (sketch — finalize in implementation)

```
tank_scenes
  id              uuid pk
  tank_id         uuid fk -> tanks
  parent_scene_id uuid fk -> tank_scenes  NULL  (phase-2 seam; always NULL in v1)
  kind            text   ('tank' | 'detail')    (v1 only ever 'tank')
  -- known physical dimensions of what this scene frames, inches
  width_in        numeric
  height_in       numeric
  depth_in        numeric
  created_at / updated_at

scene_views                              -- the calibrated photos for a scene
  id              uuid pk
  scene_id        uuid fk -> tank_scenes
  facing          text   ('front' | 'side' | 'top')
  image_path      text   (storage key)
  -- calibration: pixel<->inch mapping. Store the marked reference points and/or
  -- the derived transform; exact shape TBD in impl (homography vs. simple scale).
  calibration     jsonb

specimen_placements                      -- replaces specimens.grid_slot_id usage
  id              uuid pk
  scene_id        uuid fk -> tank_scenes
  specimen_id     uuid fk -> specimens
  x_in / y_in / z_in  numeric            -- continuous, inches, scene-local
  created_at / updated_at
```

- `specimens.grid_slot_id` stays as-is for grid-mode tanks. Whether a tank is in
  grid mode or scene mode is derivable (does it have a `tank_scenes` row?) or an
  explicit `tanks.placement_mode` column — decide in impl.
- RLS: `tank_scenes` / `scene_views` / `specimen_placements` are all owned via
  `tank_id -> tanks.user_id`, same generic owner-all pattern as `grid_slots`
  (02_rls_policies.sql). Public read for showcase mirrors the existing tank
  showcase policy (28_public_tank_showcase.sql).
- `slot_type_code` (sand/rock/frag rack) is **not** carried into the scene model:
  with a real photo backdrop, what's under a pin is visible. It survives only for
  grid-mode tanks.

## 5. Interaction Model

- **Placing:** user opens the face-on canvas, taps a coral from their specimen
  list, then taps its location on the photo. A second tap on the side-profile
  view (or a depth slider defaulting to mid-tank) sets `z_in`. Continuous — no
  snapping.
- **Manipulating "the model":** pan/zoom the face-on canvas; toggle to the
  side/depth view to read front-back position. "Manipulate to get to a rock
  outcrop" = zoom + pan on the canvas (deep-zoom style), not orbiting a mesh.
- **Editing:** drag a pin to reposition; its `(x,y,z)` updates live. Removing a
  specimen from the tank clears its placement.

## 6. Key States

| State | What renders |
|---|---|
| Tank in grid mode (existing) | Unchanged — current grid UI. |
| Opted into scene mode, no photos yet | Capture flow: "Add a face-on and a side photo of your tank." |
| Photos added, not yet calibrated | Calibration step: "Mark the tank's left and right edges" etc. |
| Calibrated, 0 placements | Canvas with the specimen list; empty of pins. |
| Placements exist | Pins at real coordinates on the canvas; depth readable in side view. |
| Specimen with no taxon (private/unID) | Placeable like any other — placement is spatial, independent of ID. |
| Dense cluster (zoa outcrop) | v1: pins may overlap at high zoom; **phase 2** nested detail-scene resolves it (see §7). |

## 7. Phase 2 — Nested Detail Scenes (the zoa-cluster payoff)

The case that motivated this feature: fire-and-ice + rasta + rasta + torch inside
~2 inches, some occluding others. No whole-tank photo has the pixels or the depth
separation to place four distinct pins there. The answer is **recursion**:

- The tank is the top-level scene. A dense spot (an outcrop) becomes a **child
  `tank_scene`** (`kind = 'detail'`, `parent_scene_id` set) with its **own
  close-up photo and its own local coordinate frame**, anchored at one point in
  the parent.
- The user shoots the outcrop from ~8 inches where the four colonies *are*
  resolvable, and places pins in that child scene.
- Recurses naturally ("the torch is on the left of the tank; within that
  outcrop, the rasta is tucked under the torch").

The v1 schema already carries `parent_scene_id` + `kind` so phase 2 is additive:
a placement's `scene_id` can point at a detail scene, and a detail scene anchors
into its parent. No v1 rewrite required. **Do not build the UI for this in v1** —
just don't foreclose it in the schema.

## 8. Open Questions / Decide-in-Implementation

- Exact calibration representation in `scene_views.calibration` (store raw marked
  points vs. a precomputed transform matrix).
- `tanks.placement_mode` explicit column vs. deriving mode from scene existence.
- Where the capture/calibration UI lives relative to `/tank/[id]` (inline vs. a
  dedicated setup route).
- Image storage: reuse the existing specimen-photo storage bucket/pattern.

## 9. Explicit Non-Goals for v1

- Orbitable 3D / photogrammetry.
- Automatic coral detection.
- Top-down capture requirement.
- Refraction correction.
- Nested detail scenes (schema-ready, UI deferred).
- Retiring `grid_slots` (coexist first).
