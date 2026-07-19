"use client";

// Catches any unhandled error inside a route (e.g. a Server Action rejected
// before it even reached our code, like the Server Actions body-size cap in
// next.config.ts) and shows a real message with a retry, instead of Next's
// blank default crash screen taking over the whole page.
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card" style={{ maxWidth: "32rem", margin: "3rem auto", textAlign: "center" }}>
      <p style={{ fontWeight: 600, marginTop: 0 }}>Something went wrong.</p>
      <p className="muted">
        That didn&apos;t go through — nothing was saved. Try again, and if it keeps
        happening, try a smaller photo.
      </p>
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
