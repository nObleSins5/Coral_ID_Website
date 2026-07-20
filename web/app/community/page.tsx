import {
  getAllMorphsForSearch,
  getCategoryOptions,
  getGenusOptionsForIdentify,
  getUnidentifiedQueue,
} from "@/lib/wiki";
import { IdentifyQueue } from "@/components/identify-queue";

export const metadata = {
  title: "Community Identification — ReefCodex",
  description:
    "Post a photo of your coral and let other hobbyists propose and vote on an identification. Confirmed IDs get their own wiki page automatically.",
};

// Dynamic: the community queue changes as photos/suggestions/votes come in,
// and the per-viewer bits (their own votes, their tanks) are resolved
// client-side. Split out of /identify (its own tab) so the self-serve
// color-match funnel isn't buried above a long, separately-scrolling queue.
export const dynamic = "force-dynamic";

export default async function CommunityIdentifyPage() {
  const [queue, morphs, categories, genusOptions] = await Promise.all([
    getUnidentifiedQueue(),
    getAllMorphsForSearch(),
    getCategoryOptions(),
    getGenusOptionsForIdentify(),
  ]);

  return (
    <div id="community" className="identify-community">
      <h1>Community identification</h1>
      <p className="muted">
        Can&apos;t find a match in <a href="/identify">Self Identification</a>? Post your photo
        here and other hobbyists can propose and vote on an identification. Confirmed IDs get
        their own wiki page automatically — and become matchable in the funnel there.
      </p>
      <IdentifyQueue
        initialQueue={queue}
        morphs={morphs}
        categories={categories}
        genusOptions={genusOptions}
      />
    </div>
  );
}
