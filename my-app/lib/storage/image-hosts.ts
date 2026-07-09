/** Stable production hostnames for public R2 buckets (custom domains). */
export const R2_PRODUCTION_IMAGE_HOSTS = [
  "listings.7eats.ca",
  "avatars.7eats.ca",
] as const;

function hostFromBucketUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Hostnames allowed for next/image remotePatterns and CDN URL validation. */
export function r2ImageHostnames(): string[] {
  return Array.from(
    new Set(
      [
        ...R2_PRODUCTION_IMAGE_HOSTS,
        hostFromBucketUrl(process.env.R2_PUBLIC_BUCKET_URL_LISTINGS),
        hostFromBucketUrl(process.env.R2_PUBLIC_BUCKET_URL_AVATARS),
      ].filter((host): host is string => Boolean(host)),
    ),
  );
}

/** Origins (scheme + host) for server-side CDN URL validation. */
export function r2ImageOrigins(): string[] {
  return r2ImageHostnames().map((host) => `https://${host}`);
}

export function isR2ImageUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return r2ImageHostnames().includes(hostname);
  } catch {
    return false;
  }
}
