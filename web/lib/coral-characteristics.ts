// Beginner-facing characteristics copy for the identify funnel's "type" and
// "genus" popups, plus the pattern-recognition step. Written from general
// reef-hobby husbandry knowledge, not cited sources — same "provisional, not
// yet cited" posture this codebase already takes with seed hex colors (see
// docs/PROGRESS.md's seed-color-accuracy entries). Static content, not a DB
// column: no moderator UI edits this copy yet.

export type Characteristics = { summary: string; traits: string[] };

export const CATEGORY_CHARACTERISTICS: Record<string, Characteristics> = {
  sps: {
    summary:
      "Hard corals with tiny polyps and a dominant, often colorful skeleton — the polyps barely show, so what you're really identifying is the coral's surface and growth shape.",
    traits: [
      "Small polyps, usually under 2mm, rarely extended enough to see individually",
      "Skeleton is the star — branching, plating, or encrusting growth forms",
      "Little visible polyp movement in normal flow",
      "Needs strong light and flow; colors often shift dramatically under different lighting",
    ],
  },
  lps: {
    summary:
      "Hard corals with large, fleshy polyps that can swell to hide most of the skeleton underneath — movement in the water current is often the first thing you notice.",
    traits: [
      "Large, visible individual polyps, often inflated well past the skeleton",
      "Skeleton (corallite) may be partly or fully hidden depending on how puffed up the polyp is",
      "Noticeable sway/movement in current — tentacles catch the flow",
      "Generally lower light/flow needs than SPS",
    ],
  },
  mushroom: {
    summary:
      "Soft-bodied, disc-shaped corals with no real skeleton — one flat or slightly domed 'cap' is almost the whole animal, so color and texture on that single disc is what identifies it.",
    traits: [
      "A single flat-to-domed oral disc — no branches, no skeleton",
      "Often shows a distinct center color vs. an outer skirt/rim color",
      "Some show a bumpy, bubble-like texture on part of the skirt — not all do",
      "Very low flow/light tolerant, hardy for beginners",
    ],
  },
  leather: {
    summary:
      "Soft corals with a rubbery body, often on a stalk, topped with a crown of small polyps — many periodically shed a thin waxy film, so their surface can look glossy or matte at different times.",
    traits: [
      "A defined stalk/base leading to a wider capitulum (cap) on many species — though some low, encrusting leathers have little to no visible stalk",
      "Small feathery or fine polyps dotting the surface",
      "Body itself is usually one muted color; polyps can differ slightly",
      "Sways gently in flow, doesn't extend far like an LPS",
    ],
  },
  zoanthid: {
    summary:
      "Colonial polyp corals that form dense mats — each individual polyp has a face (the mouth/oral disc) and a ring around it, and colors are often sharply different between the two.",
    traits: [
      "Face (oral disc/mouth) is frequently a totally different color than the ring around it",
      "Ring color often shows 1-3 distinct bands moving outward (the 'skirt')",
      "Short tentacles fringe the rim, sometimes a third distinct color",
      "Grows as a flat colonial mat, not a single individual",
    ],
  },
  "soft-coral": {
    summary:
      "Encrusting or mat-forming soft corals with no hard skeleton and no real stalk — a thin base spreads across the rock, with polyps standing up from it.",
    traits: [
      "Grows as a thin encrusting mat or spreading base rather than a defined body",
      "Polyps extend directly from the mat/base — often pulsing or waving continuously",
      "Base and polyps are frequently different colors",
      "Fast-growing and flow-loving; some (like Xenia) visibly pulse",
    ],
  },
};

export const GENUS_CHARACTERISTICS: Record<string, Characteristics> = {
  // SPS
  acropora: {
    summary:
      "The classic branching SPS — thin branches with a distinct growth-tip color, often different from the branch body.",
    traits: ["Extremely diverse coloration", "Growth tip frequently a contrasting color", "Colors often shift hue under actinic vs. daylight lighting"],
  },
  montipora: {
    summary:
      "Grows as plates, encrusting sheets, or digitate branches depending on the species — a more varied growth form than Acropora.",
    traits: ["Base color plus a contrasting polyp-dot pattern is common", "Plating and encrusting forms both common", "Often two-tone: surface color vs. polyp color"],
  },
  seriatopora: {
    summary: "Fine, thin 'bird's nest' branching with tightly-packed small branchlets.",
    traits: ["Usually one dominant color across the colony", "Branch tips sometimes slightly paler", "Very fine branch structure"],
  },
  stylophora: {
    summary: "Thicker, blunter branches than Seriatopora, with a knobby, less delicate look.",
    traits: ["Colors run warm — pink, orange, cream — more often than other SPS", "Blunt, knobby branch tips", "Fairly uniform colony color"],
  },
  pocillopora: {
    summary: "Bushy, cauliflower-like branching with a rough, verrucose (bumpy) surface texture.",
    traits: ["Rough, bumpy branch surface", "Typically a fairly uniform single color", "Dense, bushy growth"],
  },
  pavona: {
    summary: "Grows as plates, columns, or whorls with a fine, ridged surface texture rather than distinct branches.",
    traits: ["Muted, earth-toned colors more common than bright SPS colors", "Ridged, not branched, surface", "Plate/column/whorl growth forms"],
  },
  // LPS
  euphyllia: {
    summary:
      "Long, tentacled polyps (torch, hammer, frogspawn types) that extend well past the skeleton and sway constantly in flow.",
    traits: ["Tentacle tips very often a contrasting color from the base", "Constant swaying motion in flow", "Base color usually more muted than tip color"],
  },
  duncanopsammia: {
    summary:
      "Tree-like branching structure with each branch tipped by a single large, tentacled polyp (Duncan coral).",
    traits: ["Tentacles usually a uniform bright color", "Branch/skeleton color duller than the tentacles", "Tree-like branching skeleton"],
  },
  caulastraea: {
    summary:
      "Rounded, torch-like individual heads (candy cane coral) growing in loose clusters from a shared base.",
    traits: ["Often a ringed pattern — distinct center color, differently-colored outer ring", "Loosely clustered rounded heads", "Fleshy, torch-like polyps"],
  },
  micromussa: {
    summary: "Small, densely packed fleshy domes with almost no visible skeleton between polyps.",
    traits: ["Intense, saturated multi-color faces packed into a small colony", "Little to no visible skeleton", "Densely packed domed polyps"],
  },
  blastomussa: {
    summary: "Round, ball-like fleshy polyps clustered tightly on short branches, one polyp per branch tip.",
    traits: ["Center of each polyp often differs from its outer ring", "Ball-like, rounded polyp shape", "Short branching structure underneath"],
  },
  trachyphyllia: {
    summary:
      "A single large, free-living, brain-like folded polyp (open brain coral) with no attachment to rock.",
    traits: ["Deep folds often show two alternating colors following the fold pattern", "Free-living, not attached to rock", "Large single-polyp animal"],
  },
  lobophyllia: {
    summary: "Large fleshy, often folded lobes with a rough, 'meaty' fleshy texture.",
    traits: ["Frequently multi-colored within a single colony", "Rough, meaty texture", "Large, folded lobes"],
  },
  dipsastraea: {
    summary: "Tightly packed small round corallites (a true 'brain coral' texture) forming a dome.",
    traits: ["Base color plus a contrasting rim color around each corallite", "Dense, tightly packed dome", "Classic brain-coral texture"],
  },
  goniopora: {
    summary: "Long, wavy, flower-like tentacles constantly extended and swaying — among the most visibly 'moving' LPS.",
    traits: ["Tentacle tips often carry a distinct dot of contrasting color", "Constant swaying, flower-like motion", "Long, wavy tentacles"],
  },
  turbinaria: {
    summary: "Cup- or plate-shaped growth with small polyps dotting a scalloped surface.",
    traits: ["Base plate color and polyp-dot color often differ", "Scalloped, cup-like growth form", "Small, evenly dotted polyps"],
  },
  cycloseris: {
    summary:
      "A single free-living circular disc coral, not attached to rock, with radiating ridges from the center.",
    traits: ["Center and outer rim frequently differ in color", "Circular, free-living disc", "Radiating ridge texture"],
  },
  // Mushroom
  discosoma: {
    summary: "Smooth, often glossy flat disc with little to no surface texture.",
    traits: ["Solid center color, differently-colored outer rim/skirt is common", "Smooth, glossy surface", "Flat disc shape"],
  },
  rhodactis: {
    summary: "Textured, often hairy or tentacle-fringed disc surface (unlike Discosoma's smooth look).",
    traits: ["Base color plus scattered spots or a mottled pattern common", "Hairy/fringed texture", "Less glossy than Discosoma"],
  },
  ricordea: {
    summary: "Densely packed short tentacles cover the entire disc surface, giving a bumpy, jewel-like texture.",
    traits: ["Extremely saturated, often multi-color faces", "Bumpy, jewel-like surface", "Tentacles cover the whole disc, not just the rim"],
  },
  // Leather
  sarcophyton: {
    summary: "Classic 'toadstool' shape — a distinct stalk topped by a broad, flat-to-ruffled cap (capitulum).",
    traits: ["Sheds a thin film periodically", "Cap and stalk color usually uniform", "Broad, often ruffled cap"],
  },
  sinularia: {
    summary: "Finger-like or lobed branching leather with a shorter, less defined stalk than Sarcophyton.",
    traits: ["Often a single muted color — tan, brown, green", "Finger-like or lobed branches", "Shorter stalk than a toadstool leather"],
  },
  // Zoanthid
  zoanthus: {
    summary:
      "Smaller-polyped, faster-spreading zoanthids with a wide range of face/skirt color combos — the group most reef-hobby 'designer zoa' names come from.",
    traits: ["Wide range of face/skirt color combinations", "Smaller polyps, spreads quickly", "Frequently a sharply different face vs. skirt color"],
  },
  palythoa: {
    summary: "Larger-polyped, thicker-skinned relative of Zoanthus, often called 'palys.'",
    traits: ["Colors trend toward more solid/uniform faces", "Fewer sharp multi-ring skirts than Zoanthus", "Larger, thicker polyps"],
  },
  // Soft coral catch-all
  xenia: {
    summary: "Thin stalks topped with pulsing, feathery polyps that visibly open and close in a rhythm.",
    traits: ["Stalk and polyp typically the same pale color", "The pulsing motion, not color contrast, is the main tell", "Feathery polyp shape"],
  },
  clavularia: {
    summary: "Individual feathery polyps rising directly from a thin encrusting mat, with no shared stalk.",
    traits: ["Mat and polyps often differ in color", "No shared stalk — each polyp rises individually", "Thin encrusting base"],
  },
  briareum: {
    summary: "Encrusting purple-to-gray mat with small, fine polyps (star polyps).",
    traits: ["Mat base color usually distinctly different from the polyps", "Polyps often a contrasting bright color", "Fine, star-shaped polyps"],
  },
};

export type PatternExample = { summary: string; examplePair: [string, string] };

// Two representative hexes per pattern — used to render a real ColorSwatch
// demo when no real coral in the DB has that pattern documented yet (see
// getPatternExampleCoral in lib/wiki.ts for the real-data path).
export const PATTERN_CHARACTERISTICS: Record<string, PatternExample> = {
  spotted: {
    summary:
      "Small distinct dots of a second (or third) color scattered across a base color — like flecks of paint, not blended in.",
    examplePair: ["#2E8B57", "#F28C00"],
  },
  mottled: {
    summary:
      "Larger, soft-edged blotches of a second color overlapping an irregular base — blends more than spotted's crisp dots.",
    examplePair: ["#8B4513", "#5B7A3A"],
  },
  banded: {
    summary:
      "Repeating stripes running across the coral in a regular, ruler-like pattern — most common on branching or plating growth forms.",
    examplePair: ["#1E90FF", "#FFF3D6"],
  },
  tipped: {
    summary:
      "A gradual blend from a base color into a distinctly different color right at the growth tip or polyp tip — most iconic on Acropora growth tips and Euphyllia tentacle tips.",
    examplePair: ["#800080", "#FF69B4"],
  },
  ringed: {
    summary:
      "Concentric rings of alternating color radiating outward from a center point — classic on a zoanthid face/skirt or a folded LPS polyp.",
    examplePair: ["#F28C00", "#E23B3B"],
  },
  rainbow: {
    summary:
      "Several hard-edged, clearly separate colors side by side across the same structure, without blending — distinct color blocks, not a gradient.",
    examplePair: ["#E23B3B", "#1E90FF"],
  },
};
