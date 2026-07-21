import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createTank, logParameters, removeFromWishlist } from "./actions";
import { ParameterGraphButton, type GraphPoint } from "@/components/parameter-graph-button";
import { CalloutSummaryToggle } from "@/components/callout-summary-toggle";
import { getTankStatus } from "@/lib/tank-callouts";

type Tank = {
  id: string;
  name: string;
  tank_type: string | null;
  volume: number | null;
  grid_columns: number | null;
  grid_rows: number | null;
};

type EquipmentRow = {
  tank_id: string;
  equipment_type_code: string;
  brand: string | null;
  model: string | null;
};

// A short, quiet summary of what's actually logged — "AI Prime 16HD · 2
// pumps", or null if nothing's logged yet (omitted from the card entirely
// rather than shown as "Nothing logged", per the onboard brief).
function equipmentSummary(rows: EquipmentRow[]): string | null {
  const lights = rows.filter((r) => r.equipment_type_code === "light");
  const pumps = rows.filter((r) => r.equipment_type_code === "flow");
  const parts: string[] = [];
  if (lights.length === 1) {
    parts.push([lights[0].brand, lights[0].model].filter(Boolean).join(" ") || "1 light");
  } else if (lights.length > 1) {
    parts.push(`${lights.length} lights`);
  }
  if (pumps.length === 1) {
    parts.push([pumps[0].brand, pumps[0].model].filter(Boolean).join(" ") || "1 pump");
  } else if (pumps.length > 1) {
    parts.push(`${pumps.length} pumps`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

type Reading = {
  id: string;
  tank_id: string;
  measured_at: string;
  alkalinity_dkh: number | null;
  calcium_ppm: number | null;
  magnesium_ppm: number | null;
  nitrate_ppm: number | null;
  phosphate_ppm: number | null;
};

const LOG_ROWS_VISIBLE = 5;
const GRAPH_POINTS_MAX = 10;

const PARAM_COLUMNS = [
  { key: "alkalinity_dkh", label: "Alkalinity", short: "Alk", unit: "dKH" },
  { key: "calcium_ppm", label: "Calcium", short: "Ca", unit: "ppm" },
  { key: "magnesium_ppm", label: "Magnesium", short: "Mg", unit: "ppm" },
  { key: "nitrate_ppm", label: "Nitrate", short: "NO₃", unit: "ppm" },
  { key: "phosphate_ppm", label: "Phosphate", short: "PO₄", unit: "ppm" },
] as const;

// Up to GRAPH_POINTS_MAX most recent NON-NULL values for one parameter,
// newest first — a hobbyist who logs alkalinity daily but calcium weekly
// still gets a real 10-point calcium trend, not 10 mostly-empty rows.
function buildParamSeries(
  readings: Reading[],
  key: (typeof PARAM_COLUMNS)[number]["key"],
): GraphPoint[] {
  const points: GraphPoint[] = [];
  for (const r of readings) {
    const value = r[key];
    if (value == null) continue;
    points.push({ measured_at: r.measured_at, value });
    if (points.length >= GRAPH_POINTS_MAX) break;
  }
  return points;
}

type WishlistItem = {
  id: string;
  created_at: string;
  taxon_nodes: { name: string; slug: string; parent_id: string | null } | null;
};

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("username, account_type_code, is_moderator")
    .eq("id", user.id)
    .maybeSingle();

  // Explicitly scoped to the caller, not left to RLS alone: tanks_public_read
  // (32_tank_badge.sql) legitimately lets ANY authenticated user SELECT a
  // tank with is_public or badge_enabled set (that's what powers /showcase
  // and /badge), so an unfiltered query here would pull in other users'
  // public/badge-enabled tanks onto this personal "Your tanks" dashboard.
  const { data: tanks } = await supabase
    .from("tanks")
    .select("id, name, tank_type, volume, grid_columns, grid_rows")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const tankList = (tanks ?? []) as Tank[];
  const tankIds = tankList.map((t) => t.id);

  // Recent readings per tank, restricted to the caller's own tanks (see the
  // tanks query above for why — the public-read RLS policy on
  // parameter_readings has the same is_public/badge_enabled carve-out).
  // Fetched, not deleted, beyond the 5 rows shown in the log —
  // parameter_readings is append-only (see schema comment) and the graph
  // modal below needs up to GRAPH_POINTS_MAX history per parameter, which is
  // more than the visible log ever shows.
  const { data: readings } =
    tankIds.length > 0
      ? await supabase
          .from("parameter_readings")
          .select(
            "id, tank_id, measured_at, alkalinity_dkh, calcium_ppm, magnesium_ppm, nitrate_ppm, phosphate_ppm",
          )
          .in("tank_id", tankIds)
          .order("measured_at", { ascending: false })
          .limit(1000)
      : { data: [] as Reading[] };

  const readingsByTank = new Map<string, Reading[]>();
  for (const r of (readings ?? []) as Reading[]) {
    const arr = readingsByTank.get(r.tank_id);
    if (arr) arr.push(r);
    else readingsByTank.set(r.tank_id, [r]);
  }

  // Grid occupancy, equipment summary, and callout counts — the data that
  // turns each card into a doorway instead of a self-contained widget (see
  // docs/onboard-first-coral-journey-brief.md). Same explicit tank_id scoping
  // as the readings query above, for the same reason.
  const [{ data: gridSlots }, { data: occupancySpecimens }, { data: equipmentRows }, tankStatuses] =
    tankIds.length > 0
      ? await Promise.all([
          supabase.from("grid_slots").select("id, tank_id").in("tank_id", tankIds),
          supabase
            .from("specimens")
            .select("tank_id, grid_slot_id")
            .in("tank_id", tankIds)
            .is("deleted_at", null),
          supabase
            .from("equipment")
            .select("tank_id, equipment_type_code, brand, model")
            .in("tank_id", tankIds)
            .is("removed_on", null),
          Promise.all(tankList.map((t) => getTankStatus(supabase, t.id))),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, []];

  const slotCountByTank = new Map<string, number>();
  for (const s of gridSlots ?? []) {
    slotCountByTank.set(s.tank_id, (slotCountByTank.get(s.tank_id) ?? 0) + 1);
  }
  const placedCountByTank = new Map<string, number>();
  for (const s of occupancySpecimens ?? []) {
    if (!s.grid_slot_id) continue;
    placedCountByTank.set(s.tank_id, (placedCountByTank.get(s.tank_id) ?? 0) + 1);
  }
  const equipmentByTank = new Map<string, EquipmentRow[]>();
  for (const e of (equipmentRows ?? []) as EquipmentRow[]) {
    const arr = equipmentByTank.get(e.tank_id);
    if (arr) arr.push(e);
    else equipmentByTank.set(e.tank_id, [e]);
  }
  const statusByTank = new Map(tankList.map((t, i) => [t.id, tankStatuses[i]]));

  const { data: wishlist } = await supabase
    .from("want_list")
    .select("id, created_at, taxon_nodes ( name, slug, parent_id )")
    .order("created_at", { ascending: false });
  const wishlistList = (wishlist ?? []) as unknown as WishlistItem[];

  const genusIds = [
    ...new Set(
      wishlistList
        .map((w) => w.taxon_nodes?.parent_id)
        .filter((x): x is string => !!x),
    ),
  ];
  const { data: genera } =
    genusIds.length > 0
      ? await supabase.from("taxon_nodes").select("id, name, slug").in("id", genusIds)
      : { data: [] as { id: string; name: string; slug: string }[] };
  const genusById = new Map((genera ?? []).map((g) => [g.id, g]));

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <h1>Your tanks</h1>
        <form action="/auth/signout" method="post">
          <button type="submit" style={{ background: "transparent", color: "var(--muted)", border: "1px solid var(--border)" }}>
            Sign out
          </button>
        </form>
      </div>
      <p className="muted">
        Signed in as <strong>{profile?.username ?? user.email}</strong>{" "}
        <span className="pill">{profile?.account_type_code ?? "hobbyist"}</span>
        {profile?.account_type_code === "business" ? (
          <>
            {" "}
            · <a href="/business">Business dashboard</a>
          </>
        ) : null}
        {profile?.is_moderator ? (
          <>
            {" "}
            · <a href="/moderate">Moderation queue</a>
          </>
        ) : null}
      </p>

      {tankList.length === 0 ? (
        <p className="muted">No tanks yet — create your first one below.</p>
      ) : (
        tankList.map((tank) => {
          const tankReadings = readingsByTank.get(tank.id) ?? [];
          const log = tankReadings.slice(0, LOG_ROWS_VISIBLE);
          const hasGrid = !!(tank.grid_columns && tank.grid_rows);
          const slotCount = slotCountByTank.get(tank.id) ?? 0;
          const placedCount = placedCountByTank.get(tank.id) ?? 0;
          const equipSummary = equipmentSummary(equipmentByTank.get(tank.id) ?? []);
          return (
            <div className="card" key={tank.id}>
              <div className="tank-card-header">
                <h2 style={{ margin: 0, minWidth: 0 }}>
                  <a className="tank-card-open" href={`/tank/${tank.id}`}>
                    Open {tank.name}
                    {" →"}
                  </a>
                </h2>
                <CalloutSummaryToggle
                  callouts={statusByTank.get(tank.id)?.callouts ?? []}
                  husbandryHref={`/tank/${tank.id}/husbandry`}
                />
              </div>
              <p className="muted tank-card-meta">
                {tank.tank_type ? `${tank.tank_type} · ` : ""}
                {tank.volume ? `${tank.volume} gal · ` : ""}
                {hasGrid ? `${placedCount}/${slotCount} placed` : "No grid yet"}
                {equipSummary ? ` · ${equipSummary}` : ""}
              </p>

              {log.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      {PARAM_COLUMNS.map((col) => (
                        <th key={col.key}>
                          <div className="param-log-head">
                            <span>
                              {col.short} ({col.unit})
                            </span>
                            <ParameterGraphButton
                              label={col.label}
                              unit={col.unit}
                              tankName={tank.name}
                              points={buildParamSeries(tankReadings, col.key)}
                            />
                          </div>
                        </th>
                      ))}
                      <th>Logged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((r) => (
                      <tr key={r.id}>
                        <td>{r.alkalinity_dkh ?? "—"}</td>
                        <td>{r.calcium_ppm ?? "—"}</td>
                        <td>{r.magnesium_ppm ?? "—"}</td>
                        <td>{r.nitrate_ppm ?? "—"}</td>
                        <td>{r.phosphate_ppm ?? "—"}</td>
                        <td className="muted">
                          {new Date(r.measured_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">No parameters logged yet.</p>
              )}

              <form action={logParameters}>
                <input type="hidden" name="tank_id" value={tank.id} />
                <div className="row">
                  <div>
                    <label>Alk (dKH)</label>
                    <input name="alkalinity_dkh" type="number" step="0.1" inputMode="decimal" />
                  </div>
                  <div>
                    <label>Ca (ppm)</label>
                    <input name="calcium_ppm" type="number" step="1" inputMode="decimal" />
                  </div>
                  <div>
                    <label>Mg (ppm)</label>
                    <input name="magnesium_ppm" type="number" step="1" inputMode="decimal" />
                  </div>
                  <div>
                    <label>NO₃ (ppm)</label>
                    <input name="nitrate_ppm" type="number" step="0.1" inputMode="decimal" />
                  </div>
                  <div>
                    <label>PO₄ (ppm)</label>
                    <input name="phosphate_ppm" type="number" step="0.01" inputMode="decimal" />
                  </div>
                </div>
                <button type="submit">Log parameters</button>
              </form>
            </div>
          );
        })
      )}

      <h2 id="add-a-tank">Add a tank</h2>
      <form className="card" action={createTank}>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required placeholder="e.g. 75g Mixed Reef" />
        <div className="row">
          <div>
            <label htmlFor="tank_type">Type</label>
            <input id="tank_type" name="tank_type" placeholder="Mixed / SPS / Frag" />
          </div>
          <div>
            <label htmlFor="volume">Volume (gal)</label>
            <input id="volume" name="volume" type="number" step="0.1" inputMode="decimal" />
          </div>
          <div>
            <label htmlFor="established_on">Established</label>
            <input id="established_on" name="established_on" type="date" />
          </div>
        </div>
        <div className="row">
          <div>
            <label htmlFor="length">Length (in)</label>
            <input id="length" name="length" type="number" step="0.1" inputMode="decimal" />
          </div>
          <div>
            <label htmlFor="width">Width (in)</label>
            <input id="width" name="width" type="number" step="0.1" inputMode="decimal" />
          </div>
          <div>
            <label htmlFor="height">Height (in)</label>
            <input id="height" name="height" type="number" step="0.1" inputMode="decimal" />
          </div>
        </div>

        <p className="muted" style={{ marginBottom: "0.25rem" }}>
          Grid layout (optional — you can set this up later from the tank page)
        </p>
        <div className="row">
          <div>
            <label htmlFor="grid_columns">Columns</label>
            <input id="grid_columns" name="grid_columns" type="number" min="1" step="1" />
          </div>
          <div>
            <label htmlFor="grid_rows">Rows</label>
            <input id="grid_rows" name="grid_rows" type="number" min="1" step="1" />
          </div>
          <div>
            <label htmlFor="tier_count">Tiers (height)</label>
            <input id="tier_count" name="tier_count" type="number" min="1" step="1" defaultValue={1} />
          </div>
        </div>
        <button type="submit">Create tank</button>
      </form>

      <h2>My wishlist</h2>
      {wishlistList.length === 0 ? (
        <p className="muted">
          Nothing yet — wishlist a coral from its <a href="/wiki">wiki page</a>.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Coral</th>
              <th>Genus</th>
              <th>Date added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {wishlistList.map((w) => {
              const genus = w.taxon_nodes?.parent_id
                ? genusById.get(w.taxon_nodes.parent_id)
                : undefined;
              const morphSlug = w.taxon_nodes?.slug;
              const href =
                genus && morphSlug ? `/coral/${genus.slug}/${morphSlug}` : "#";
              return (
                <tr key={w.id}>
                  <td>
                    <a href={href}>{w.taxon_nodes?.name ?? "Unknown coral"}</a>
                  </td>
                  <td className="muted">{genus?.name ?? "—"}</td>
                  <td className="muted">
                    {new Date(w.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <form action={removeFromWishlist}>
                      <input type="hidden" name="want_list_id" value={w.id} />
                      <button
                        type="submit"
                        className="btn-secondary"
                        style={{ marginTop: 0 }}
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
