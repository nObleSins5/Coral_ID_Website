import { signup } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <h1>Create your account</h1>
      <form className="card" action={signup}>
        <label htmlFor="username">Username</label>
        <input id="username" name="username" required />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />

        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required minLength={6} />

        <label htmlFor="account_type">Account type</label>
        <select id="account_type" name="account_type" defaultValue="hobbyist">
          <option value="hobbyist">Hobbyist</option>
          <option value="business">Business</option>
        </select>

        <div className="row">
          <div>
            <label htmlFor="region">Region</label>
            <input id="region" name="region" placeholder="e.g. Southeast US" />
          </div>
          <div>
            <label htmlFor="state">State</label>
            <input id="state" name="state" placeholder="e.g. GA" />
          </div>
          <div>
            <label htmlFor="zip">Zip</label>
            <input id="zip" name="zip" placeholder="e.g. 30301" />
          </div>
        </div>

        <button type="submit">Sign up</button>
        {error ? <p className="error">{error}</p> : null}
      </form>
      <p className="muted">
        Already have an account? <a href="/login">Log in</a>.
      </p>
      <p className="muted">
        Zip is stored now so local-trade matching can be switched on later
        without re-asking.
      </p>
    </div>
  );
}
