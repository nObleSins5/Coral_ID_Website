"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SearchableMorph } from "@/lib/wiki";

// Global "jump straight to a coral" search, client-fetched on mount (same
// pattern as AuthNavLink/AddPhotoForm) rather than fetched in RootLayout —
// keeps the layout itself static so pages under it can still be statically
// generated. Reuses the same 37-row searchable-morph shape as the /identify
// propose form and quick-add-specimen, just filtered here for direct
// navigation instead of an identification match.
export function HeaderSearch() {
  const router = useRouter();
  const [morphs, setMorphs] = useState<SearchableMorph[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: morphRows } = await supabase
        .from("taxon_nodes")
        .select("id, name, slug, parent_id")
        .eq("rank_code", "morph")
        .order("name");
      const { data: generaRows } = await supabase
        .from("taxon_nodes")
        .select("id, name, slug")
        .eq("rank_code", "genus");
      const generaById = new Map((generaRows ?? []).map((g) => [g.id, g]));
      setMorphs(
        (morphRows ?? []).map((m) => {
          const genus = m.parent_id ? generaById.get(m.parent_id) : undefined;
          return {
            id: m.id,
            name: m.name,
            slug: m.slug,
            genusName: genus?.name ?? "",
            genusSlug: genus?.slug ?? "",
          };
        }),
      );
    })();
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

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return morphs
      .filter((m) => m.name.toLowerCase().includes(q) || m.genusName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, morphs]);

  function goTo(m: SearchableMorph) {
    setQuery("");
    setOpen(false);
    router.push(`/coral/${m.genusSlug}/${m.slug}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      goTo(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="header-search" ref={containerRef}>
      <input
        type="text"
        value={query}
        placeholder="Search corals…"
        aria-label="Search corals"
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {open && results.length > 0 && (
        <div className="header-search-results">
          {results.map((m, i) => (
            <button
              type="button"
              key={m.id}
              className={`header-search-result${i === activeIndex ? " active" : ""}`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => goTo(m)}
            >
              {m.name} <span className="muted">({m.genusName})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
