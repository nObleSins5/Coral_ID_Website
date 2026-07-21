"use client";

import { useState, useTransition } from "react";
import { requestPasswordReset } from "@/app/reset-password/actions";

export function ResetPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if (result?.error) setError(result.error);
      else setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="card">
        <p style={{ marginTop: 0 }}>
          If an account exists for that email, a password reset link is on its way. Check your
          inbox (and spam folder) for an email from ReefCodex.
        </p>
      </div>
    );
  }

  return (
    <form className="card" action={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required />

      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
