"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// The nav's one auth-dependent item. A client island so the pages this
// layout wraps (several are statically generated) don't have to become
// dynamic just to know whether someone's logged in — same pattern already
// used by AddPhotoForm/AddSpecimenForm elsewhere in this app. Previously a
// hardcoded "Log in" link regardless of session state (see docs/PROGRESS.md
// harden pass).
export function AuthNavLink() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setLoggedIn(!!user);
    });
  }, []);

  if (loggedIn === null) return null;

  if (!loggedIn) return <a href="/login">Log in</a>;

  return (
    <form action="/auth/signout" method="post" className="nav-signout-form">
      <button type="submit">Sign out</button>
    </form>
  );
}
