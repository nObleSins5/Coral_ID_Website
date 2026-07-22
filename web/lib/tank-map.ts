// Shared constants/types for the photo-tile tank map — mirrors lib/grid.ts's
// role for the X/Y/Z grid. Caps are enforced in app/tank/map-actions.ts at
// insert time, same convention as MAX_GRID_SLOTS in lib/grid.ts (app-layer
// check, no DB trigger).
export const MAX_MAP_TILES = 30;
export const MAX_MAP_PINS = 50;

// Konva draws to <canvas>, not the DOM — CSS custom properties (var(--accent))
// never resolve there, canvas fillStyle/stroke need a literal color. These
// mirror app/globals.css's design tokens (DESIGN.md §2 Colors) and must be
// kept in sync by hand if that palette ever changes.
export const MAP_COLORS = {
  accent: "#70d6ff", // --accent / Shallow Reef Blue
  accentInk: "#072433", // --accent-ink / Abyssal Ink
  danger: "#b91c1c", // --danger / Bleached Coral Red
  border: "#e1e8ee", // --border / Sandbar
} as const;

export type MapTile = {
  id: string;
  storagePath: string;
  publicUrl: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  cropX: number;
  cropY: number;
  cropWidth: number | null;
  cropHeight: number | null;
  // Tiles sharing a tileGroupId are locked together (PowerPoint-style
  // group) — see 37_tank_map_tile_groups.sql. null = not in a group.
  tileGroupId: string | null;
};

export type MapPin = {
  id: string;
  coralId: string;
  tileId: string;
  posX: number;
  posY: number;
  label: string | null;
  taxonName: string | null;
  representativePhotoUrl: string | null;
};
