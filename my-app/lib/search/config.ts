/** Tunable parameters for the kitchen search ranking + matching. */

/** Radius cap (km) for pickup discovery — matches the max delivery radius a cook
 * can configure, so browse/search surface the same reach for both modes. */
export const SEARCH_PICKUP_MAX_KM = 100;

/**
 * Minimum trigram word-similarity for a fuzzy (typo) match to qualify when the
 * full-text query finds nothing. Low enough to catch real typos
 * ("shawrma" -> "shawarma" ~ 0.4) without surfacing unrelated noise.
 */
export const SEARCH_SIM_THRESHOLD = 0.3;

/** Relevance score weights (see lib/search/query.ts). */
export const SEARCH_WEIGHTS = {
  fts: 1.0, // weighted full-text rank (ts_rank)
  similarity: 0.6, // trigram word-similarity (typo tolerance)
  proximity: 0.5, // closer kitchens rank higher
  popularity: 0.25, // rating + completed-order signal
} as const;

/** Default + max page size for search results. */
export const SEARCH_DEFAULT_LIMIT = 30;
export const SEARCH_MAX_LIMIT = 50;

/** Max suggestions returned by the autocomplete endpoint. */
export const SUGGEST_LIMIT = 8;

/** Longest query we will process (defends the trigram/FTS path). */
export const SEARCH_MAX_QUERY_LEN = 100;
