"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  username: string;
  account_type_code: string;
  is_moderator: boolean;
};

// Replaces the old AuthNavLink (a bare "Log in" link / "Sign out" button)
// with a top-anchored account dropdown — tanks, account settings, and
// (conditionally) the business/moderator destinations that used to only
// live as extra lines of text on the dashboard. Chosen over a left-side
// drawer: this is a short, account-scoped action list, not primary site
// navigation, and a drawer would give the site two competing nav paradigms
// instead of one quiet system (see chat — tcgplayer-style avatar menu).
export function AccountMenu() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setLoggedIn(!!user);
      if (!user) return;
      const { data } = await supabase
        .from("users")
        .select("username, account_type_code, is_moderator")
        .eq("id", user.id)
        .maybeSingle();
      if (data) setProfile(data as Profile);
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loggedIn === null) return null;
  if (!loggedIn) return <a href="/login">Log in</a>;

  const initial = (profile?.username || "?").charAt(0).toUpperCase();

  return (
    <div
      className="account-menu"
      ref={containerRef}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className="account-menu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <span className="account-avatar">{initial}</span>
      </button>
      {open && (
        <div className="account-menu-dropdown">
          <p className="account-menu-username">{profile?.username ?? "Account"}</p>
          <a href="/dashboard" onClick={() => setOpen(false)}>
            Your tanks
          </a>
          <a href="/account" onClick={() => setOpen(false)}>
            Account settings
          </a>
          {profile?.account_type_code === "business" ? (
            <a href="/business" onClick={() => setOpen(false)}>
              Business dashboard
            </a>
          ) : null}
          {profile?.is_moderator ? (
            <a href="/moderate" onClick={() => setOpen(false)}>
              Moderation queue
            </a>
          ) : null}
          <form action="/auth/signout" method="post">
            <button type="submit" className="account-menu-signout">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
