"use client";

import type { CategoryOption, GenusOption } from "@/lib/wiki";

// Shared "category, then genus" cascading picker — anywhere a flat genus
// dropdown used to list every genus in the registry at once (propose an
// identification, quick-post-photo), pick the type first (SPS/LPS/Mushroom/
// etc) to narrow the genus list down to just that type's genera. Picking a
// category clears any genus selection that no longer belongs to it; picking
// "Not sure at all — genus unknown" (the hidden placeholder bucket) clears
// the category, since that option has no category of its own.
export function CategoryGenusPicker({
  categories,
  genusOptions,
  categorySlug,
  genusId,
  onCategoryChange,
  onGenusChange,
  genusLabel = "Genus",
  includeAnyGenus = true,
}: {
  categories: CategoryOption[];
  genusOptions: GenusOption[];
  categorySlug: string | null;
  genusId: string;
  onCategoryChange: (slug: string | null) => void;
  onGenusChange: (id: string) => void;
  genusLabel?: string;
  includeAnyGenus?: boolean;
}) {
  const filteredGenusOptions = categorySlug
    ? genusOptions.filter((g) => g.categorySlug === categorySlug || g.isUnknownBucket)
    : genusOptions;

  return (
    <>
      <label>Type</label>
      <select
        value={categorySlug ?? ""}
        onChange={(e) => {
          const slug = e.target.value || null;
          onCategoryChange(slug);
          const stillValid = genusOptions.find(
            (g) => g.id === genusId && (!slug || g.categorySlug === slug || g.isUnknownBucket),
          );
          if (!stillValid) onGenusChange("");
        }}
      >
        <option value="">Any type</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>

      <label>{genusLabel}</label>
      <select
        value={genusId}
        onChange={(e) => {
          const id = e.target.value;
          onGenusChange(id);
          if (id) {
            const g = genusOptions.find((g) => g.id === id);
            if (g?.categorySlug) onCategoryChange(g.categorySlug);
          }
        }}
      >
        <option value="">{includeAnyGenus ? "Any genus" : "Choose a genus"}</option>
        {filteredGenusOptions.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </>
  );
}
