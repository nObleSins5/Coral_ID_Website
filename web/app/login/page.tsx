import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="auth-shell">
      <h1>Log in</h1>
      <form className="card" action={login}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />

        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required />

        <button type="submit">Log in</button>
        {error ? <p className="error">{error}</p> : null}
      </form>
      <p className="muted">
        Need an account? <a href="/signup">Sign up</a>.
      </p>
    </div>
  );
}
