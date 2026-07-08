"use client";

// Shared "pick a representative photo" grid — used by both AddSpecimenForm
// (initial pick) and EditSpecimenForm (change it later). Purely a display
// pick (see specimens.representative_photo_id) distinct from true photo
// provenance (coral_photos.specimen_id).
export type PickablePhoto = { id: string; url: string; uploader_user_id: string };

export function PhotoPicker({
  photos,
  userId,
  selectedId,
  onSelect,
}: {
  photos: PickablePhoto[];
  userId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (photos.length === 0) return null;
  return (
    <div className="specimen-photo-picker">
      <button
        type="button"
        className={`specimen-photo-none${selectedId === null ? " selected" : ""}`}
        onClick={() => onSelect(null)}
      >
        None
      </button>
      {photos.map((p) => (
        <button
          type="button"
          key={p.id}
          className={`specimen-photo-option${selectedId === p.id ? " selected" : ""}`}
          onClick={() => onSelect(p.id)}
          title={p.uploader_user_id === userId ? "Your photo" : "Community photo"}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt="" />
          {p.uploader_user_id === userId ? (
            <span className="specimen-photo-tag">Yours</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
