import { getCoralsForColorMatch, getFunnelCategories, getIdentifyShowcaseData } from "@/lib/wiki";
import { CoralIdentifyFunnel } from "@/components/coral-identify-funnel";

export const metadata = {
  title: "Self Identification — ReefCodex",
  description:
    "Identify your coral by the colors you see — pick its shape and colors and compare against real, structured trait data. No coral-anatomy knowledge needed.",
};

// CoralIdentifyFunnel reads/writes funnel state via useSearchParams() with no
// Suspense boundary around it (a deliberate choice — see PROGRESS.md
// 2026-07-16: wrapping it in <Suspense> instead caused the funnel to render
// as a DOM sibling AFTER other page content due to streaming SSR reordering).
// force-dynamic is what makes that safe: the page is never statically
// prerendered, so Next's "useSearchParams needs a Suspense boundary" build
// check — which only fires for a static/prerendered shell — doesn't apply.
// Dropping this (as happened when /identify was split from /community) will
// fail the build with a prerender error the moment this page is eligible
// for static generation again.
export const dynamic = "force-dynamic";

export default async function IdentifyPage() {
  const [corals, categories] = await Promise.all([
    getCoralsForColorMatch(),
    getFunnelCategories(),
  ]);
  const showcase = await getIdentifyShowcaseData(categories);

  return (
    <div>
      <h1>Self Identification</h1>
      <p className="muted identify-lede">
        Tell us what you see — the type, the genus if you know it, and the colors — and
        we&apos;ll match it against the registry&apos;s real, element-by-element trait data.
        No coral-anatomy knowledge needed.
      </p>

      <CoralIdentifyFunnel corals={corals} categories={categories} showcase={showcase} />

      <p className="muted identify-community-pointer">
        Still stuck? <a href="/community">Ask the community</a> — post your photo and other
        hobbyists can propose and vote on an identification.
      </p>
    </div>
  );
}
