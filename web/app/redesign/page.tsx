import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  getAllMorphsForSearch,
  getFeaturedMorphs,
  getGenera,
  getMorphBySlug,
} from "@/lib/wiki";
import { CARE_DIFFICULTY, CarePill, ElementColorKey } from "@/components/coral-ui";
import { RegistrySearch } from "@/components/redesign/registry-search";
import { Badge } from "@/components/redesign/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/redesign/ui/card";
import { Separator } from "@/components/redesign/ui/separator";

// Same worked example the current front page uses as its differentiator —
// a real, well-documented morph, not a fabricated one.
const DOSSIER_MORPH_SLUG = "walt-disney-acropora";

const DIFFICULTY_TOKEN: Record<string, string> = {
  easy: "bg-polyp-lime",
  moderate: "bg-sun-bleached-yellow",
  difficult: "bg-low-tide-orange",
  expert: "bg-anemone-pink",
};

function paramRange(min: number | null, max: number | null, unit: string) {
  if (min == null && max == null) return "—";
  if (min != null && max != null) return `${min}–${max} ${unit}`;
  return `${min ?? max} ${unit}`;
}

export default async function RedesignHome() {
  const [genera, allMorphs, dossier, recent] = await Promise.all([
    getGenera(),
    getAllMorphsForSearch(),
    getMorphBySlug(DOSSIER_MORPH_SLUG),
    getFeaturedMorphs(6),
  ]);

  const totalMorphs = genera.reduce((sum, g) => sum + g.morph_count, 0);
  const dossierGenus = dossier
    ? genera.find((g) => g.id === dossier.parent_id)
    : undefined;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-16 py-2">
      {/* Masthead: real, plainly-stated counts — the registry's own scale,
          not a decorative stat card. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <Badge
          variant="outline"
          className="border-border font-medium tracking-wide text-muted-foreground uppercase"
        >
          ReefCodex
        </Badge>
        <span className="tabular-nums">
          <strong className="font-semibold text-foreground">{totalMorphs}</strong>{" "}
          corals catalogued
        </span>
        <Separator orientation="vertical" className="h-4" />
        <span className="tabular-nums">
          <strong className="font-semibold text-foreground">{genera.length}</strong>{" "}
          genera
        </span>
      </div>

      {/* Hero: the registry lookup is the primary CTA, not a pair of
          buttons over a stock photo. */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <h1 className="max-w-2xl text-balance">
            Look up a coral by its actual colors — not a guess.
          </h1>
          <p className="max-w-[46ch] text-lg text-muted-foreground">
            Every entry is real, sampled, element-by-element trait data —
            hex colors, growth form, care difficulty — cross-linked like a
            reference database, not another feed of lookalike photos.
          </p>
        </div>

        <div className="max-w-xl">
          <RegistrySearch morphs={allMorphs} />
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link
            href="/identify"
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            Can&apos;t find it? Propose an identification
            <ArrowRight className="size-3.5" />
          </Link>
          <Link
            href="/wiki"
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            Browse the full wiki
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      {/* Dossier: one real entry, shown exactly as its own registry page
          would render it — the actual ElementColorKey component, not a
          marketing mockup of one. */}
      {dossier ? (
        <section>
          <Card className="gap-4 rounded-xl border-border bg-card py-5 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_1px_3px_rgba(16,24,40,0.08)]">
            <CardHeader className="gap-1 px-6">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Sample entry
              </span>
              <CardTitle className="text-xl">
                <Link
                  href={`/coral/${dossierGenus?.slug ?? ""}/${dossier.slug}`}
                  className="hover:underline"
                >
                  {dossier.name}
                </Link>
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                {dossierGenus ? <span>{dossierGenus.name}</span> : null}
                {dossier.care_difficulty_code ? (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-[#072433] ${
                      DIFFICULTY_TOKEN[dossier.care_difficulty_code] ?? "bg-secondary"
                    }`}
                  >
                    {CARE_DIFFICULTY[dossier.care_difficulty_code] ??
                      dossier.care_difficulty_code}
                  </span>
                ) : null}
                <CarePill kind="light" code={dossier.light_level_code} />
                <CarePill kind="flow" code={dossier.flow_level_code} />
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-6">
              <p className="text-sm text-muted-foreground">
                Real sampled hex colors, element by element:
              </p>
              <ElementColorKey colorRanges={dossier.color_ranges} />
              <Separator />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
                <div className="flex justify-between gap-2 sm:flex-col sm:gap-0.5">
                  <dt className="text-muted-foreground">Alkalinity</dt>
                  <dd className="font-medium tabular-nums">
                    {paramRange(
                      dossier.rec_alkalinity_dkh_min,
                      dossier.rec_alkalinity_dkh_max,
                      "dKH",
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 sm:flex-col sm:gap-0.5">
                  <dt className="text-muted-foreground">Calcium</dt>
                  <dd className="font-medium tabular-nums">
                    {paramRange(
                      dossier.rec_calcium_ppm_min,
                      dossier.rec_calcium_ppm_max,
                      "ppm",
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 sm:flex-col sm:gap-0.5">
                  <dt className="text-muted-foreground">Temperature</dt>
                  <dd className="font-medium tabular-nums">
                    {paramRange(
                      dossier.rec_temperature_c_min,
                      dossier.rec_temperature_c_max,
                      "°C",
                    )}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* Recently catalogued: an actual ledger, styled like the registry's
          own browse rows — not a repeated card grid. */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2>Recently catalogued</h2>
          <Link
            href="/wiki"
            className="text-sm font-medium text-accent hover:underline"
          >
            View all →
          </Link>
        </div>

        {recent.length > 0 ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.06),0_1px_3px_rgba(16,24,40,0.08)]">
            {recent.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/coral/${m.genusSlug}/${m.slug}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-secondary/60"
                >
                  <div className="size-12 shrink-0 overflow-hidden rounded-md border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.heroUrl}
                      alt={`${m.name} — representative photo`}
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-foreground">
                      {m.name}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {m.genusName}
                    </span>
                  </div>
                  {m.care_difficulty_code ? (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-[#072433] ${
                        DIFFICULTY_TOKEN[m.care_difficulty_code] ?? "bg-secondary"
                      }`}
                    >
                      {CARE_DIFFICULTY[m.care_difficulty_code] ??
                        m.care_difficulty_code}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No community photos yet —{" "}
            <Link href="/identify" className="text-accent hover:underline">
              be the first to log one
            </Link>
            .
          </p>
        )}
      </section>

      <Separator />

      {/* Quiet closing prompt — a line, not a boxed CTA band. */}
      <section className="flex flex-wrap items-center justify-between gap-4 pb-8">
        <p className="text-sm text-muted-foreground">
          Track your own tank&apos;s parameters and specimens in the same
          registry.
        </p>
        <div className="flex gap-4 text-sm font-medium">
          <Link href="/signup" className="text-accent hover:underline">
            Create an account
          </Link>
          <Link
            href="/login"
            style={{ color: "var(--rd-muted-foreground)" }}
            className="hover:underline"
          >
            Log in
          </Link>
        </div>
      </section>
    </div>
  );
}
