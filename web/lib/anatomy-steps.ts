// The identify funnel's anatomy-aware color step-through, and its mirror in
// the moderator color-entry form (components/color-moderation.tsx). Groups
// each anatomy template's fine-grained element_type_code positions (see
// sql/supabase/20_anatomy_templates.sql / 22_decouple_color_from_elements.sql
// / 29_anatomy_template_refinements.sql) into the coarser, beginner-facing
// steps a novice actually thinks in — "the skirt", not "skirt_1/2/3".
//
// This is deliberately data-driven over the existing anatomy_template_elements
// table rather than a one-off zoanthid-only feature: the same STEP_GROUPS
// config drives the consumer funnel's step-through, the moderator's grouped
// entry form, and (via optional steps) the "not every coral of this genus has
// this part" case (a leather without a real stalk, a mushroom without a
// bubbled skirt).

export type AnatomyStep = {
  key: string; // stable, unique within a template's own step list
  label: string;
  positions: string[]; // element_type_code values this step covers
  optional?: boolean; // renders a "Not on this coral" skip toggle
};

export const STEP_GROUPS: Record<string, AnatomyStep[]> = {
  zoanthid_paly: [
    { key: "mouth", label: "Mouth", positions: ["oral_disc_center"] },
    { key: "skirt", label: "Skirt", positions: ["skirt_1", "skirt_2", "skirt_3"] },
    { key: "tentacles", label: "Tentacles", positions: ["tentacle"] },
  ],
  branching_sps: [
    { key: "growth_tip", label: "Growth tip", positions: ["growth_tip"] },
    {
      key: "skin_structure",
      label: "Skin and Structure",
      positions: ["coenosarc_skin", "axial_corallite", "radial_corallite"],
    },
    { key: "tentacles", label: "Tentacles", positions: ["tentacle"] },
  ],
  lps_corallite: [
    { key: "skin_structure", label: "Skin and Structure", positions: ["coenosarc_skin", "corallite"] },
    { key: "mouth", label: "Mouth", positions: ["mouth_oral_disc"] },
  ],
  lps_tentacled: [
    { key: "skin", label: "Skin", positions: ["coenosarc_skin"] },
    { key: "tentacles", label: "Tentacles", positions: ["tentacle"] },
    { key: "mouth", label: "Mouth", positions: ["mouth_oral_disc"] },
  ],
  mushroom_coral: [
    { key: "center", label: "Center", positions: ["oral_disc_center"] },
    { key: "skirt", label: "Skirt", positions: ["skirt_1", "skirt_2", "skirt_3"] },
    { key: "bubbles", label: "Bubbles", positions: ["bubble_tip"], optional: true },
  ],
  leather_soft_coral: [
    { key: "stalk", label: "Stalk", positions: ["stalk"], optional: true },
    { key: "body", label: "Body", positions: ["base_body"] },
    { key: "tentacles", label: "Tentacles", positions: ["tentacle"] },
  ],
  mat_soft_coral: [
    { key: "body", label: "Body", positions: ["base_body"] },
    { key: "tentacles", label: "Tentacles", positions: ["tentacle"] },
  ],
};

// A representative template per category, used when the user hasn't (or
// won't) pick a specific genus — the stepper still needs *something* to
// show, same low-friction "optional, has a sensible default" posture as the
// rest of the funnel.
export const CATEGORY_DEFAULT_TEMPLATE: Record<string, string> = {
  sps: "branching_sps",
  lps: "lps_corallite",
  mushroom: "mushroom_coral",
  leather: "leather_soft_coral",
  zoanthid: "zoanthid_paly",
  "soft-coral": "mat_soft_coral",
};

export function resolveTemplateCode(
  categorySlug: string | null,
  genusAnatomyTemplateCode: string | null | undefined,
): string | null {
  if (genusAnatomyTemplateCode) return genusAnatomyTemplateCode;
  if (categorySlug) return CATEGORY_DEFAULT_TEMPLATE[categorySlug] ?? null;
  return null;
}

export function stepsForTemplate(templateCode: string | null): AnatomyStep[] {
  if (!templateCode) return [];
  return STEP_GROUPS[templateCode] ?? [];
}
