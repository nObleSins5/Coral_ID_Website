// Shared grid-slot layout helpers — a tank's grid is generated once (columns
// x rows x tiers) and never resized in place; see docs/schema-decisions.md §4.
export const MAX_GRID_SLOTS = 500;

// 1-indexed spreadsheet-style column letters: 1 -> A, 26 -> Z, 27 -> AA...
export function columnLabel(n: number): string {
  let label = "";
  let num = n;
  while (num > 0) {
    const rem = (num - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    num = Math.floor((num - 1) / 26);
  }
  return label;
}

// e.g. (3, 5, 1, tierCount=1) -> "C5"; (3, 5, 2, tierCount=3) -> "C5 · L2".
export function slotLabel(x: number, y: number, z: number, tierCount: number): string {
  const base = `${columnLabel(x)}${y}`;
  return tierCount > 1 ? `${base} · L${z}` : base;
}

export type NewGridSlot = {
  tank_id: string;
  x: number;
  y: number;
  z: number;
  label: string;
};

export function buildGridSlots(
  tankId: string,
  columns: number,
  rows: number,
  tiers: number,
): NewGridSlot[] {
  const slots: NewGridSlot[] = [];
  for (let z = 1; z <= tiers; z++) {
    for (let y = 1; y <= rows; y++) {
      for (let x = 1; x <= columns; x++) {
        slots.push({ tank_id: tankId, x, y, z, label: slotLabel(x, y, z, tiers) });
      }
    }
  }
  return slots;
}
