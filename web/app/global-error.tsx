"use client";

// Only fires for errors thrown in the root layout itself (app/error.tsx
// handles everything else) — must render its own <html>/<body> since it
// replaces the root layout when it triggers.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", textAlign: "center", padding: "3rem 1rem" }}>
        <p style={{ fontWeight: 600 }}>Something went wrong.</p>
        <p>Nothing was saved. Try reloading the page.</p>
        <button type="button" onClick={() => reset()}>
          Try again
        </button>
      </body>
    </html>
  );
}
