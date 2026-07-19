import { signup } from "./actions";
import { COUNTRIES } from "@/lib/countries";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="auth-shell">
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

        <label htmlFor="country_code">Country</label>
        <select id="country_code" name="country_code" required defaultValue="">
          <option value="" disabled>
            Select your country…
          </option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="row">
          <div>
            <label htmlFor="state">State / Province / Region</label>
            <input id="state" name="state" placeholder="Optional" />
          </div>
          <div>
            <label htmlFor="postal_code">Postal code</label>
            <input id="postal_code" name="postal_code" placeholder="Optional" />
          </div>
        </div>

        <button type="submit">Sign up</button>
        {error ? <p className="error">{error}</p> : null}
      </form>
      <p className="muted">
        Already have an account? <a href="/login">Log in</a>.
      </p>
      <p className="muted">
        Your country (and postal code, if you add it) are stored now so
        regional trade matching can be switched on later without re-asking —
        never a street address.
      </p>
    </div>
  );
}
