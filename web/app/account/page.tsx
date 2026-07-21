import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountProfileForm } from "@/components/account-profile-form";
import { ChangePasswordForm } from "@/components/change-password-form";

export const metadata = {
  title: "Account settings — ReefCodex",
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("username, display_name, preferred_temp_unit, account_type_code")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div>
      <p className="breadcrumb">
        <a href="/dashboard">Your tanks</a> / Account settings
      </p>
      <h1>Account settings</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Signed in as {user.email}
        {profile?.account_type_code === "business" ? (
          <>
            {" "}
            · <span className="pill">business</span> · <a href="/business">Business dashboard</a>
          </>
        ) : null}
      </p>

      <AccountProfileForm
        profile={{
          username: profile?.username ?? "",
          display_name: profile?.display_name ?? null,
          preferred_temp_unit: profile?.preferred_temp_unit ?? "F",
        }}
      />

      <ChangePasswordForm />
    </div>
  );
}
