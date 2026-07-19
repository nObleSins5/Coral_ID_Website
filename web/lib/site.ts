// Absolute site origin — needed anywhere a URL is generated for consumption
// OFF this site (forum embed snippets, badge image src, etc.), where the
// request host can't be relied on. Falls back to the production domain so
// this works even if the env var isn't set in preview/dev.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://reefcodex.com";
