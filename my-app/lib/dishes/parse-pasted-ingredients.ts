const PASTE_SPLIT = /[,\n]/;

/** Splits a pasted comma- or newline-separated blob into trimmed, non-empty names. */
export function parsePastedNames(text: string): string[] {
  return text
    .split(PASTE_SPLIT)
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

/** Filters `candidates` down to names not already present (case-insensitive) in `existingNames`. */
export function dedupeAgainst(
  existingNames: string[],
  candidates: string[],
): { added: string[]; duplicateCount: number } {
  const seen = new Set(existingNames.map((n) => n.toLowerCase()));
  const added: string[] = [];
  let duplicateCount = 0;
  for (const name of candidates) {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(key);
    added.push(name);
  }
  return { added, duplicateCount };
}
