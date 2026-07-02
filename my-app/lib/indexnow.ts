import { SITE_ORIGIN } from "@/lib/seo-routes";

// IndexNow instantly notifies Bing (and Yandex, Seznam, etc.) when URLs are
// added or changed, instead of waiting for the next crawl. Google ignores
// IndexNow, but Bing powers ChatGPT search and Copilot, so this feeds our
// AI-visibility track. The key is public by design: it is served at
// /<key>.txt so search engines can verify ownership.
export const INDEXNOW_KEY = "5f03697890561d4869a4fb61d1a0b798";

const HOST = "www.7eats.ca";
const ENDPOINT = "https://api.indexnow.org/indexnow";

/**
 * Notify IndexNow that one or more URLs were added or updated. Fire-and-forget:
 * errors are logged, never thrown, so a submission failure can never break the
 * calling request. Only absolute URLs on the 7eats.ca host are submitted.
 *
 * Call this after publishing indexable dynamic content, e.g. a newly public
 * cook profile:
 *   await submitToIndexNow([`${SITE_ORIGIN}/app/cooks/${cookId}`]);
 */
export async function submitToIndexNow(urls: string[]): Promise<void> {
  const urlList = urls.filter((u) => u.startsWith(SITE_ORIGIN));
  if (urlList.length === 0) return;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
    });
    if (!res.ok) {
      console.warn(
        `[indexnow] submission failed: ${res.status} ${res.statusText}`,
      );
    }
  } catch (err) {
    console.warn("[indexnow] submission error:", err);
  }
}
