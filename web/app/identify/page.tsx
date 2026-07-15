import {
  getAllMorphsForSearch,
  getCoralsForColorMatch,
  getFunnelCategories,
  getGenera,
  getUnidentifiedQueue,
} from "@/lib/wiki";
import { CoralIdentifyFunnel } from "@/components/coral-identify-funnel";
import { IdentifyQueue } from "@/components/identify-queue";

export const metadata = {
  title: "Identify a Coral — Reef Platform",
  description:
    "Identify your coral by the colors you see — pick its shape and colors and compare against real, structured trait data. Or post a photo for the community.",
};

// Dynamic: the community queue changes as photos/suggestions/votes come in,
// and the per-viewer bits (their own votes, their tanks) are resolved
// client-side.
export const dynamic = "force-dynamic";

export default async function IdentifyPage() {
  const [corals, categories, queue, morphs, genera] = await Promise.all([
    getCoralsForColorMatch(),
    getFunnelCategories(),
    getUnidentifiedQueue(),
    getAllMorphsForSearch(),
    getGenera(),
  ]);

  return (
    <div>
      <h1>Identify a coral</h1>
      <p className="muted identify-lede">
        Tell us what you see — the shape and the colors — and we&apos;ll match it against
        the registry&apos;s real, element-by-element trait data. No coral-anatomy knowledge
        needed.
      </p>

      <CoralIdentifyFunnel corals={corals} categories={categories} />

      <section id="community" className="identify-community">
        <h2>Still stuck? Ask the community</h2>
        <p className="muted">
          Can&apos;t find a match above? Post your photo here and other hobbyists can
          propose and vote on an identification. Confirmed IDs get their own wiki page
          automatically — and become matchable in the funnel above.
        </p>
        <IdentifyQueue initialQueue={queue} morphs={morphs} genera={genera} />
      </section>
    </div>
  );
}
