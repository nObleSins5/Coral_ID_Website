export default function Home() {
  return (
    <div>
      <h1>Reef Platform</h1>
      <p className="muted">
        Log your tank&apos;s parameters, equipment, and coral inventory — and
        help build a crowdsourced record linking coral coloration to the
        conditions that produced it.
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Coral wiki</h2>
        <p className="muted">
          Browse by genus, drill into a morph, and compare its typical
          element colors against your own coral.
        </p>
        <p>
          <a href="/wiki">Browse the coral wiki →</a>
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Phase 0 vertical slice</h2>
        <p className="muted">
          This early build proves the core loop end to end:
        </p>
        <p>Sign up → create a tank → log your first parameters.</p>
        <p>
          <a href="/signup">Create an account</a> &nbsp;·&nbsp;{" "}
          <a href="/login">Log in</a>
        </p>
      </div>
    </div>
  );
}
