"use client";

import { useState, useTransition } from "react";
import { updatePassword } from "@/app/account/actions";

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updatePassword(formData);
      if (result?.error) setError(result.error);
      else {
        setSaved(true);
        (document.getElementById("change-password-form") as HTMLFormElement | null)?.reset();
      }
    });
  }

  return (
    <form id="change-password-form" className="card" action={handleSubmit}>
      <h2 style={{ marginTop: 0 }}>Change password</h2>

      <label htmlFor="password">New password</label>
      <input id="password" name="password" type="password" minLength={6} required />

      <label htmlFor="confirm_password">Confirm new password</label>
      <input id="confirm_password" name="confirm_password" type="password" minLength={6} required />

      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </button>
      </div>
      {saved ? <p className="muted">Password updated.</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
