// A one-time onboarding nudge on /tank/[id] — mutually exclusive with
// TankStatusBlock (see docs/onboard-first-coral-journey-brief.md). Only
// rendered once a grid exists (the app's own quick-add flow requires a grid
// before a coral can be placed, so "grid configured" is always true by the
// time this shows — listed anyway so the 3-step progress reads honestly).
// Plain list, no progress bar/percentage/gamification, per PRODUCT.md's
// "field guide, not a storefront" brand personality.

export function OnboardingChecklist({
  hasCoral,
  hasEquipment,
  addCoralHref,
  husbandryHref,
}: {
  hasCoral: boolean;
  hasEquipment: boolean;
  addCoralHref: string;
  husbandryHref: string;
}) {
  return (
    <div className="onboarding-checklist">
      <p className="muted tank-status-line">Get this tank set up:</p>
      <ul className="onboarding-checklist-list">
        <li className="onboarding-checklist-item done">Grid configured</li>
        <li className={`onboarding-checklist-item ${hasCoral ? "done" : ""}`}>
          {hasCoral ? "Coral added" : <a href={addCoralHref}>Add your first coral</a>}
        </li>
        <li className={`onboarding-checklist-item ${hasEquipment ? "done" : ""}`}>
          {hasEquipment ? "Equipment logged" : <a href={husbandryHref}>Log your equipment →</a>}
        </li>
      </ul>
    </div>
  );
}
