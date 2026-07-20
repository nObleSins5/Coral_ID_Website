import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata = {
  title: "Reset your password — ReefCodex",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="auth-shell">
      <h1>Reset your password</h1>
      <p className="muted">Enter your account email and we&apos;ll send you a reset link.</p>
      {error ? <p className="error">{error}</p> : null}
      <ResetPasswordForm />
      <p className="muted">
        <a href="/login">Back to log in</a>
      </p>
    </div>
  );
}
