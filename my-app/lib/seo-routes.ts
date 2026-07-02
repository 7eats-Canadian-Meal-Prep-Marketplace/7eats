import type { MetadataRoute } from "next";

/** Canonical production origin (no trailing slash). */
export const SITE_ORIGIN = "https://www.7eats.ca";

type ChangeFrequency = NonNullable<
  MetadataRoute.Sitemap[number]["changeFrequency"]
>;

type PublicRoute = {
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
};

/**
 * Single source of truth for the public, indexable routes. Used by the sitemap
 * and by IndexNow submissions so the two never drift apart. Dynamic pages (cook
 * profiles, dishes) are not listed here — submit those to IndexNow individually
 * when they are published.
 */
export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  { path: "/", changeFrequency: "monthly", priority: 1.0 },
  { path: "/public/waitlist", changeFrequency: "monthly", priority: 0.9 },
  { path: "/business/home", changeFrequency: "monthly", priority: 0.8 },
  { path: "/app/browse", changeFrequency: "daily", priority: 0.8 },
  { path: "/business/application", changeFrequency: "monthly", priority: 0.7 },
  { path: "/public/team", changeFrequency: "monthly", priority: 0.5 },
  { path: "/help", changeFrequency: "monthly", priority: 0.5 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cook-terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/food-safety", changeFrequency: "yearly", priority: 0.3 },
  { path: "/refund-policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/community-guidelines", changeFrequency: "yearly", priority: 0.3 },
];

/** Absolute URL for a single path (root maps to the bare origin). */
export function absoluteUrl(path: string): string {
  return path === "/" ? SITE_ORIGIN : `${SITE_ORIGIN}${path}`;
}

/** Absolute URLs for every public route. */
export function publicUrls(): string[] {
  return PUBLIC_ROUTES.map((route) => absoluteUrl(route.path));
}
