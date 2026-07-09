import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createTank, logParameters, removeFromWishlist } from "./actions";

type Tank = {
  id: string;
  name: string;
  tank_type: string | null;
  volume: number | null;
};

type Reading = {
  tank_id: string;
  measured_at: string;
  alkalinity_dkh: number | null;
  calcium_ppm: number | null;
  magnesium_ppm: number | null;
  nitrate_ppm: number | null;
  phosphate_ppm: number | null;
};

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
    .select("username, account_type_code")
    .eq("id", user.id)
    .maybeSingle();

  const { data: tanks } = await supabase
    .from("tanks")
    .select("id, name, tank_type, volume")
    .order("created_at", { ascending: true });

  // Most recent reading per tank (RLS scopes to the caller's tanks).
  const { data: readings } = await supabase
    .from("parameter_readings")
    .select(
      "tank_id, measured_at, alkalinity_dkh, calcium_ppm, magnesium_ppm, nitrate_ppm, phosphate_ppm",
    )
    .order("measured_at", { ascending: false });

  const latest = new Map<string, Reading>();
  for (const r of (readings ?? []) as Reading[]) {
    if (!latest.has(r.tank_id)) latest.set(r.tank_id, r);
  }

  const tankList = (tanks ?? []) as Tank[];

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
      </p>

      {tankList.length === 0 ? (
        <p className="muted">No tanks yet — create your first one below.</p>
      ) : (
        tankList.map((tank) => {
          const r = latest.get(tank.id);
          return (
            <div className="card" key={tank.id}>
              <h2 style={{ marginTop: 0 }}>
                <a href={`/tank/${tank.id}`}>{tank.name}</a>{" "}
                <span className="muted" style={{ fontWeight: 400, fontSize: "0.9rem" }}>
                  {tank.tank_type ? `· ${tank.tank_type}` : ""}
                  {tank.volume ? ` · ${tank.volume} gal` : ""}
                </span>
              </h2>

              {r ? (
                <table>
                  <thead>
                    <tr>
                      <th>Alk (dKH)</th>
                      <th>Ca (ppm)</th>
                      <th>Mg (ppm)</th>
                      <th>NO₃ (ppm)</th>
                      <th>PO₄ (ppm)</th>
                      <th>Logged</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{r.alkalinity_dkh ?? "—"}</td>
                      <td>{r.calcium_ppm ?? "—"}</td>
                      <td>{r.magnesium_ppm ?? "—"}</td>
                      <td>{r.nitrate_ppm ?? "—"}</td>
                      <td>{r.phosphate_ppm ?? "—"}</td>
                      <td className="muted">
                        {new Date(r.measured_at).toLocaleString()}
                      </td>
                    </tr>
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

      <h2>Add a tank</h2>
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
