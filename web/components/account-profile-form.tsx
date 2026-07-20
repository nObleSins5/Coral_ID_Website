"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/app/account/actions";

type Profile = {
  username: string;
  display_name: string | null;
  preferred_temp_unit: string;
};

export function AccountProfileForm({ profile }: { profile: Profile }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <form className="card" action={handleSubmit}>
      <h2 style={{ marginTop: 0 }}>Profile</h2>

      <label htmlFor="username">Username</label>
      <input id="username" name="username" defaultValue={profile.username} required />

      <label htmlFor="display_name">Display name (optional)</label>
      <input
        id="display_name"
        name="display_name"
        defaultValue={profile.display_name ?? ""}
        placeholder="Shown in place of your username where space allows"
      />

      <label htmlFor="preferred_temp_unit">Preferred temperature unit</label>
      <select
        id="preferred_temp_unit"
        name="preferred_temp_unit"
        defaultValue={profile.preferred_temp_unit}
      >
        <option value="F">Fahrenheit (°F)</option>
        <option value="C">Celsius (°C)</option>
      </select>

      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
      {saved ? <p className="muted">Saved.</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
