"use client";

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/redesign/ui/input";
import type { SearchableMorph } from "@/lib/wiki";

// The front page's primary CTA: a real lookup against the whole 37-coral
// registry (client-filtered, same dataset /identify's propose form uses —
// getAllMorphsForSearch), not a pair of generic buttons over a photo.
export function RegistrySearch({ morphs }: { morphs: SearchableMorph[] }) {
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [open, setOpen] = useState(false);
  const listId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return morphs
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.genusName.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [morphs, query]);

  function goTo(m: SearchableMorph) {
    window.location.href = `/coral/${m.genusSlug}/${m.slug}`;
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="text"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={`Search ${morphs.length} catalogued corals`}
          placeholder={`Search ${morphs.length} catalogued corals — try "Acropora"…`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlighted(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (results.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlighted((h) => (h + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlighted((h) => (h - 1 + results.length) % results.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              goTo(results[highlighted]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </div>

      {open && results.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="absolute z-10 mt-2 w-full overflow-hidden rounded-lg border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.06),0_1px_3px_rgba(16,24,40,0.08)]"
        >
          {results.map((m, i) => (
            <li
              key={m.id}
              role="option"
              aria-selected={i === highlighted}
              onMouseDown={(e) => {
                e.preventDefault();
                goTo(m);
              }}
              onMouseEnter={() => setHighlighted(i)}
              style={{ backgroundColor: i === highlighted ? "var(--rd-secondary)" : "transparent" }}
              className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm"
            >
              <span className="font-medium text-foreground">{m.name}</span>
              <span className="text-muted-foreground">{m.genusName}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
