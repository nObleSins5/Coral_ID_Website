"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { quickPostPhoto } from "@/app/coral/actions";
import type { SearchableMorph } from "@/lib/wiki";

type Tank = { id: string; name: string };
type Genus = { id: string; name: string; slug: string };

type PostedItem = {
  id: string;
  thumbnail: string;
  name: string;
  outcome: "posted" | "new_morph_proposed" | "sent_to_identify";
  href?: string;
};

const OUTCOME_LABEL: Record<PostedItem["outcome"], string> = {
  posted: "Posted",
  new_morph_proposed: "Submitted for review",
  sent_to_identify: "Sent to /identify",
};

// The landing-page "clear my camera roll" flow — one photo + a typed name
// per submit, reusing quickPostPhoto's three-way fork (app/coral/actions.ts):
// matched morph -> posts immediately; no match but a tagged genus -> new-morph
// proposal (moderator_confirm_suggestion / the vote trigger picks it up from
// there, sql/supabase/33_moderator_confirm_suggestion.sql); no match and no
// genus -> straight to the /identify queue. The tank picker deliberately
// persists across submits (only the photo + name reset) so working through a
// whole batch of photos for one tank doesn't mean re-picking it every time.
export function QuickPostPhoto({
  morphs,
  genera,
}: {
  morphs: SearchableMorph[];
  genera: Genus[];
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [tankId, setTankId] = useState("");

  const [query, setQuery] = useState("");
  const [matched, setMatched] = useState<SearchableMorph | null>(null);
  const [genusId, setGenusId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [posted, setPosted] = useState<PostedItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      setLoadingUser(false);
      if (user) {
        const { data: tankRows } = await supabase
          .from("tanks")
          .select("id, name")
          .order("created_at", { ascending: true });
        setTanks(tankRows ?? []);
      }
    })();
  }, []);

  const results = useMemo(() => {
    if (matched || query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return morphs
      .filter((m) => m.name.toLowerCase().includes(q) || m.genusName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, matched, morphs]);

  const showGenusTag = !matched && query.trim().length >= 2 && results.length === 0;
  const taggedGenus = genusId ? genera.find((g) => g.id === genusId) : null;

  function selectMatch(m: SearchableMorph | null) {
    setMatched(m);
    setGenusId("");
  }

  function resetForPhoto() {
    setQuery("");
    setMatched(null);
    setGenusId("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a photo first.");
      return;
    }

    if (matched) {
      formData.set("taxon_node_id", matched.id);
      formData.set("genus_slug", matched.genusSlug);
      formData.set("morph_slug", matched.slug);
    } else if (genusId) {
      const name = query.trim();
      if (!name) {
        setError("Type the coral's name.");
        return;
      }
      formData.set("genus_id", genusId);
      formData.set("proposed_name", name);
      formData.set("genus_slug", taggedGenus?.slug ?? "");
    }
    if (tankId) formData.set("tank_id", tankId);

    const label = matched ? matched.name : query.trim() || "Untitled";
    const thumbnail = URL.createObjectURL(file);

    startTransition(async () => {
      const result = await quickPostPhoto(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setPosted((prev) => [
        { id: crypto.randomUUID(), thumbnail, name: label, outcome: result.outcome!, href: result.href },
        ...prev,
      ]);
      resetForPhoto();
    });
  }

  if (loadingUser) return null;

  if (!userId) {
    return (
      <section className="quick-post card">
        <h2 style={{ marginTop: 0 }}>Clear your camera roll</h2>
        <p className="muted">
          <a href="/login">Log in</a> to quickly post your tank photos, one at a time.
        </p>
      </section>
    );
  }

  return (
    <section className="quick-post card">
      <h2 style={{ marginTop: 0 }}>Clear your camera roll</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Pick a photo, type the coral&apos;s name, hit post — then straight on to the next one.
      </p>

      <form ref={formRef} className="quick-post-form" action={handleSubmit}>
        <label htmlFor="quick-post-photo">Photo</label>
        <input
          ref={fileInputRef}
          id="quick-post-photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />

        <label htmlFor="quick-post-name">Coral name</label>
        <input
          id="quick-post-name"
          value={matched ? matched.name : query}
          onChange={(e) => {
            selectMatch(null);
            setQuery(e.target.value);
          }}
          placeholder="e.g. Walt Disney"
          autoComplete="off"
        />
        {results.length > 0 ? (
          <div className="taxon-results">
            {results.map((m) => (
              <button
                type="button"
                key={m.id}
                className="taxon-result"
                onClick={() => selectMatch(m)}
              >
                {m.name} <span className="muted">({m.genusName})</span>
              </button>
            ))}
          </div>
        ) : null}

        {showGenusTag ? (
          <>
            <label htmlFor="quick-post-genus">Tag a genus (optional)</label>
            <select
              id="quick-post-genus"
              value={genusId}
              onChange={(e) => setGenusId(e.target.value)}
            >
              <option value="">Not sure — send to /identify for the community</option>
              {genera.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            {genusId ? (
              <p className="muted quick-post-hint">
                No exact match — this will be submitted as a new coral for review, tagged
                under {taggedGenus?.name}.
              </p>
            ) : (
              <p className="muted quick-post-hint">
                No exact match and no genus tagged — this photo will go to /identify for the
                community to help ID.
              </p>
            )}
          </>
        ) : null}

        <label htmlFor="quick-post-tank">Tank (optional — stays selected for your next photo)</label>
        <div className="quick-post-tank-row">
          <select
            id="quick-post-tank"
            value={tankId}
            onChange={(e) => setTankId(e.target.value)}
          >
            <option value="">No tank / standalone</option>
            {tanks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <a href="/dashboard#add-a-tank" target="_blank" rel="noopener noreferrer">
            Need a tank first? Create one →
          </a>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={pending}>
            {pending
              ? "Posting…"
              : matched
                ? "Post"
                : genusId
                  ? "Submit for review"
                  : "Post"}
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </form>

      {posted.length > 0 ? (
        <div className="quick-post-list">
          <h3>Posted this session</h3>
          {posted.map((p) => (
            <div className="quick-post-list-row" key={p.id}>
              <div className="quick-post-list-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbnail} alt="" />
              </div>
              <div>
                <p style={{ margin: 0 }}>
                  <strong>{p.name}</strong>
                </p>
                <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                  {p.href ? <a href={p.href}>{OUTCOME_LABEL[p.outcome]}</a> : OUTCOME_LABEL[p.outcome]}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
