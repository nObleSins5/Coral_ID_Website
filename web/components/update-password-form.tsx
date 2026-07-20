"use client";

import { useState, useTransition } from "react";
import { updatePasswordAndContinue } from "@/app/account/actions";

export function UpdatePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updatePasswordAndContinue(formData);
      if (result?.error) setError(result.error);
      // On success the action itself redirects to /dashboard.
    });
  }

  return (
    <form className="card" action={handleSubmit}>
      <label htmlFor="password">New password</label>
      <input id="password" name="password" type="password" minLength={6} required />

      <label htmlFor="confirm_password">Confirm new password</label>
      <input id="confirm_password" name="confirm_password" type="password" minLength={6} required />

      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Updating…" : "Set new password"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
