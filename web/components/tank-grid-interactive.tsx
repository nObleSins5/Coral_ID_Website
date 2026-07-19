"use client";

import { useState } from "react";
import { TankMockup } from "@/components/tank-grid-view";
import { GridSlotPanel, type Occupant, type UnplacedOption } from "@/components/grid-slot-panel";
import { RecoverGridSlotsControl } from "@/components/recover-grid-slots-control";
import type { SearchableMorph } from "@/lib/wiki";

type Genus = { id: string; name: string };

export type GridSlotData = {
  id: string;
  x: number;
  y: number;
  z: number;
  label: string;
  slotTypeCode: string | null;
  disabled: boolean;
};

export type SlotOccupant = Occupant & { photoUrl: string | null; href: string | null };

// Replaces TankGridView on the owner-facing /tank/[id] page (tank-grid-view.tsx
// stays as-is — it's still used, unchanged, by the read-only public
// /showcase/[id] page). Every cell is now a real button: clicking one opens
// GridSlotPanel right below the grid for that slot (substrate type, "not
// usable for coral", and — if empty — placing or quick-adding a coral).
// Defaults to tier 1 (the substrate), not the top tier TankGridView opened
// on, since that's where an owner actually starts building out a tank.
export function TankGridInteractive({
  tankId,
  columns,
  slots,
  occupantBySlotId,
  unplaced,
  morphs,
  genera,
}: {
  tankId: string;
  columns: number;
  slots: GridSlotData[];
  occupantBySlotId: Map<string, SlotOccupant>;
  unplaced: UnplacedOption[];
  morphs: SearchableMorph[];
  genera: Genus[];
}) {
  const tierCount = slots.length > 0 ? Math.max(...slots.map((s) => s.z)) : 1;
  const [selectedTier, setSelectedTier] = useState(1);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  const tierSlots = slots.filter((s) => s.z === selectedTier);
  const activeSlot = slots.find((s) => s.id === activeSlotId) ?? null;

  function openSlot(id: string) {
    setActiveSlotId((current) => (current === id ? null : id));
  }

  const grid = (
    <div className="tank-grid-tier">
      <div className="tank-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(70px, 1fr))` }}>
        {tierSlots.map((slot) => {
          if (slot.disabled) {
            return <div key={slot.id} className="tank-grid-cell-hidden" aria-hidden="true" />;
          }
          const occupant = occupantBySlotId.get(slot.id) ?? null;
          const typeClass = slot.slotTypeCode ? ` slot-${slot.slotTypeCode}` : "";
          const activeClass = slot.id === activeSlotId ? " active" : "";
          return (
            <div
              key={slot.id}
              className={`tank-grid-cell ${occupant ? "occupied" : "empty"}${typeClass}${activeClass}`}
            >
              <span className="slot-label">{slot.label}</span>
              {occupant ? (
                <>
                  {occupant.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={occupant.photoUrl} alt="" className="tank-grid-cell-thumb" />
                  ) : null}
                  <a href={occupant.href ?? `/specimen/${occupant.specimenId}`}>
                    {occupant.name || occupant.taxonName || "Unnamed coral"}
                  </a>
                  <button type="button" className="tank-grid-cell-edit" onClick={() => openSlot(slot.id)}>
                    ⚙ Edit slot
                  </button>
                </>
              ) : (
                <button type="button" className="tank-grid-cell-empty-btn" onClick={() => openSlot(slot.id)}>
                  + Add / edit
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      {tierCount > 1 ? (
        <div className="tank-grid-view">
          <div className="tier-rail">
            <TankMockup tierCount={tierCount} selected={selectedTier} />
            <div className="tier-rail-buttons">
              {Array.from({ length: tierCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={n === selectedTier ? "selected" : ""}
                  onClick={() => setSelectedTier(n)}
                >
                  Tier {n}
                </button>
              ))}
            </div>
          </div>
          {grid}
        </div>
      ) : (
        grid
      )}

      {activeSlot ? (
        <GridSlotPanel
          key={`${activeSlot.id}-${activeSlot.slotTypeCode}-${activeSlot.disabled}`}
          slot={{
            id: activeSlot.id,
            label: activeSlot.label,
            slotTypeCode: activeSlot.slotTypeCode,
            disabled: activeSlot.disabled,
          }}
          tankId={tankId}
          occupant={occupantBySlotId.get(activeSlot.id) ?? null}
          unplaced={unplaced}
          isTopTier={activeSlot.z === tierCount}
          morphs={morphs}
          genera={genera}
          onClose={() => setActiveSlotId(null)}
        />
      ) : null}

      <div style={{ marginTop: "0.75rem" }}>
        <RecoverGridSlotsControl tankId={tankId} disabledSlots={slots.filter((s) => s.disabled)} />
      </div>
    </div>
  );
}
