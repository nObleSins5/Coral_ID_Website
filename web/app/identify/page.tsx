import {
  getAllMorphsForSearch,
  getGenera,
  getUnidentifiedQueue,
} from "@/lib/wiki";
import { IdentifyQueue } from "@/components/identify-queue";

export const metadata = {
  title: "Identify a Coral — Reef Platform",
  description:
    "Upload a photo of a coral you can't identify, or help the community identify one — browse and vote on pending suggestions.",
};

// Dynamic: the queue changes as photos/suggestions/votes come in, and the
// per-viewer bits (their own votes, their tanks) are resolved client-side.
export const dynamic = "force-dynamic";

export default async function IdentifyPage() {
  const [queue, morphs, genera] = await Promise.all([
    getUnidentifiedQueue(),
    getAllMorphsForSearch(),
    getGenera(),
  ]);

  return (
    <div>
      <h1>Identify a coral</h1>
      <p className="muted">
        Upload a photo of a coral you can&apos;t identify, or help identify
        someone else&apos;s. Confirmed identifications get their own wiki
        page automatically.
      </p>
      <IdentifyQueue initialQueue={queue} morphs={morphs} genera={genera} />
    </div>
  );
}
