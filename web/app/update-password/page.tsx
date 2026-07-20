import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "@/components/update-password-form";

export const metadata = {
  title: "Set a new password — ReefCodex",
};

// Landing point after a recovery-email link verifies (app/auth/confirm) —
// requires the session that verifyOtp just established, same as any other
// authenticated page (redirects to /login otherwise, e.g. if the link was
// already used or someone hits this URL directly with no session).
export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="auth-shell">
      <h1>Set a new password</h1>
      <UpdatePasswordForm />
    </div>
  );
}
