import { getCoralsForColorMatch, getFunnelCategories, getIdentifyShowcaseData } from "@/lib/wiki";
import { CoralIdentifyFunnel } from "@/components/coral-identify-funnel";

export const metadata = {
  title: "Self Identification — ReefCodex",
  description:
    "Identify your coral by the colors you see — pick its shape and colors and compare against real, structured trait data. No coral-anatomy knowledge needed.",
};

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
