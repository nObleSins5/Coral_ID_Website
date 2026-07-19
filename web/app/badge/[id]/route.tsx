import { ImageResponse } from "next/og";
import { createPublicClient } from "@/lib/supabase/public";
import { getBadgeData, PARAM_META, type ParamKey } from "@/lib/tank-callouts";
import { SITE_URL } from "@/lib/site";

// Pastable forum-signature badge — current parameters + species + a link
// back to the public tank page (/showcase/[id]). Public, session-less
// (getBadgeData returns null unless the tank has is_public or badge_enabled
// set, matching the RLS gate from 32_tank_badge.sql). Cached for an hour so
// repeated forum-page views don't hit Supabase on every load, while staying
// fresh enough for a stats badge.

const WIDTH = 600;
const HEIGHT = 200;

const PARAM_ORDER: ParamKey[] = [
  "alkalinity_dkh",
  "calcium_ppm",
  "magnesium_ppm",
  "nitrate_ppm",
  "phosphate_ppm",
];

function unavailableImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f9fc",
          border: "1px solid #e1e8ee",
          color: "#55636e",
          fontSize: 20,
        }}
      >
        ReefCodex badge unavailable
      </div>
    ),
    { width: WIDTH, height: HEIGHT, status: 404 },
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createPublicClient();
  const data = await getBadgeData(supabase, id);
  if (!data) return unavailableImage();

  const { tankName, latestReading, speciesNames } = data;

  const paramEntries = latestReading
    ? PARAM_ORDER.map((key) => ({ key, value: latestReading[key] })).filter(
        (p): p is { key: ParamKey; value: number } => p.value != null,
      )
    : [];

  const shownSpecies = speciesNames.slice(0, 5);
  const extraCount = speciesNames.length - shownSpecies.length;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          border: "2px solid #70d6ff",
          borderRadius: 10,
          padding: "16px 22px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#16202a" }}>
            Reef<span style={{ color: "#0369a1" }}>Codex</span>
          </span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#16202a" }}>{tankName}</span>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {paramEntries.length > 0 ? (
            paramEntries.map((p) => (
              <div key={p.key} style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 11, color: "#55636e" }}>{PARAM_META[p.key].label}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#072433" }}>
                  {p.value} {PARAM_META[p.key].unit}
                </span>
              </div>
            ))
          ) : (
            <span style={{ fontSize: 14, color: "#55636e" }}>No parameters logged yet</span>
          )}
        </div>

        <div style={{ display: "flex", fontSize: 14, color: "#16202a" }}>
          {shownSpecies.length > 0
            ? shownSpecies.join(", ") + (extraCount > 0 ? ` +${extraCount} more` : "")
            : "No corals catalogued yet"}
        </div>

        <div style={{ display: "flex", fontSize: 11, color: "#55636e" }}>
          {SITE_URL.replace(/^https?:\/\//, "")}/showcase/{id}
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: { "Cache-Control": "public, max-age=3600" },
    },
  );
}
