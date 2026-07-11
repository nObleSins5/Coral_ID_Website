"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  uploadUnidentifiedPhoto,
  voteOnSuggestion,
  removePhoto,
} from "@/app/identify/actions";
import { ProposeIdentificationForm } from "@/components/propose-identification-form";
import type {
  PendingSuggestion,
  SearchableMorph,
  UnidentifiedQueueItem,
} from "@/lib/wiki";

type Tank = { id: string; name: string };
type Genus = { id: string; name: string };

// --- Upload form -------------------------------------------------------

function UploadForm({ tanks }: { tanks: Tank[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}>
        + Add a photo to identify
      </button>
    );
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadUnidentifiedPhoto(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <form className="add-photo-form" action={handleSubmit}>
      <label htmlFor="identify-photo">Photo</label>
      <input
        id="identify-photo"
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required
      />

      <label htmlFor="identify-tank">Tank (optional — stamps your latest parameters)</label>
      <select id="identify-tank" name="tank_id" defaultValue="">
        <option value="">No tank / standalone</option>
        {tanks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <label htmlFor="identify-taken-at">Date taken</label>
      <input
        id="identify-taken-at"
        name="taken_at"
        type="date"
        defaultValue={new Date().toISOString().slice(0, 10)}
      />

      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

// --- Vote buttons --------------------------------------------------------

function VoteButtons({
  suggestionId,
  netVotes,
  myVote,
}: {
  suggestionId: string;
  netVotes: number;
  myVote: 1 | -1 | undefined;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function vote(direction: "up" | "down") {
    const formData = new FormData();
    formData.set("suggestion_id", suggestionId);
    formData.set("direction", direction);
    startTransition(async () => {
      await voteOnSuggestion(formData);
      router.refresh();
    });
  }

  return (
    <span className="suggestion-votes">
      <button
        type="button"
        className={`vote-button${myVote === 1 ? " voted" : ""}`}
        disabled={pending}
        onClick={() => vote("up")}
        title="Agree"
      >
        ▲
      </button>
      <span className="suggestion-net">{netVotes}</span>
      <button
        type="button"
        className={`vote-button${myVote === -1 ? " voted" : ""}`}
        disabled={pending}
        onClick={() => vote("down")}
        title="Disagree"
      >
        ▼
      </button>
    </span>
  );
}

// --- One unidentified photo's card -----------------------------------------

function PhotoCard({
  item,
  userId,
  myVotes,
  morphs,
  genera,
  proposingFor,
  setProposingFor,
}: {
  item: UnidentifiedQueueItem;
  userId: string | null;
  myVotes: Map<string, 1 | -1>;
  morphs: SearchableMorph[];
  genera: Genus[];
  proposingFor: string | null;
  setProposingFor: (id: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isOwner = userId === item.photo.uploader_user_id;
  const isProposing = proposingFor === item.photo.id;

  function handleRemove() {
    const formData = new FormData();
    formData.set("photo_id", item.photo.id);
    startTransition(async () => {
      await removePhoto(formData);
      router.refresh();
    });
  }

  return (
    <div className="identify-card">
      <div className="identify-card-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.photo.url} alt="" />
      </div>
      <div className="identify-card-body">
        {item.suggestions.length === 0 ? (
          <p className="muted">No suggestions yet.</p>
        ) : (
          <ul className="suggestion-list">
            {item.suggestions.map((s: PendingSuggestion) => (
              <li key={s.id} className="suggestion-row">
                <span className="suggestion-name">
                  {s.proposed_taxon_name ?? s.proposed_name}
                  {s.proposed_taxon_name && s.proposed_name ? (
                    <span className="muted"> — &quot;{s.proposed_name}&quot;?</span>
                  ) : null}
                  {!s.proposed_taxon_name && s.proposed_genus_name ? (
                    <span className="muted"> ({s.proposed_genus_name})</span>
                  ) : null}
                </span>
                <span className="muted suggestion-by">by {s.suggested_by_username}</span>
                <VoteButtons
                  suggestionId={s.id}
                  netVotes={s.net_votes}
                  myVote={myVotes.get(s.id)}
                />
              </li>
            ))}
          </ul>
        )}

        {isProposing ? (
          <ProposeIdentificationForm
            photoId={item.photo.id}
            morphs={morphs}
            genera={genera}
            onDone={() => setProposingFor(null)}
          />
        ) : (
          <div className="identify-card-actions">
            {userId ? (
              <button type="button" onClick={() => setProposingFor(item.photo.id)}>
                Propose a name
              </button>
            ) : (
              <span className="muted">
                <a href="/login">Log in</a> to propose or vote.
              </span>
            )}
            {isOwner && (
              <button
                type="button"
                className="btn-secondary"
                disabled={pending}
                onClick={handleRemove}
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Top-level queue --------------------------------------------------------

export function IdentifyQueue({
  initialQueue,
  morphs,
  genera,
}: {
  initialQueue: UnidentifiedQueueItem[];
  morphs: SearchableMorph[];
  genera: Genus[];
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [myVotes, setMyVotes] = useState<Map<string, 1 | -1>>(new Map());
  const [proposingFor, setProposingFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const allSuggestionIds = useMemo(
    () => initialQueue.flatMap((q) => q.suggestions.map((s) => s.id)),
    [initialQueue],
  );

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (user) {
        const { data: tankRows } = await supabase
          .from("tanks")
          .select("id, name")
          .order("created_at", { ascending: true });
        setTanks(tankRows ?? []);

        if (allSuggestionIds.length > 0) {
          const { data: voteRows } = await supabase
            .from("id_votes")
            .select("id_suggestion_id, value")
            .eq("user_id", user.id)
            .in("id_suggestion_id", allSuggestionIds);
          const map = new Map<string, 1 | -1>();
          for (const v of voteRows ?? []) map.set(v.id_suggestion_id, v.value as 1 | -1);
          setMyVotes(map);
        }
      }
      setLoading(false);
    })();
    // allSuggestionIds is derived from initialQueue (a server-fetched prop) —
    // stable per render of this page, intentionally not a dependency here to
    // avoid refetching on every local state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="card">{!loading && (userId ? <UploadForm tanks={tanks} /> : (
        <p className="muted">
          <a href="/login">Log in</a> to upload a photo for identification.
        </p>
      ))}</div>

      {initialQueue.length === 0 ? (
        <p className="muted">No unidentified photos right now — check back soon.</p>
      ) : (
        <div className="identify-list">
          {initialQueue.map((item) => (
            <PhotoCard
              key={item.photo.id}
              item={item}
              userId={userId}
              myVotes={myVotes}
              morphs={morphs}
              genera={genera}
              proposingFor={proposingFor}
              setProposingFor={setProposingFor}
            />
          ))}
        </div>
      )}
    </div>
  );
}
