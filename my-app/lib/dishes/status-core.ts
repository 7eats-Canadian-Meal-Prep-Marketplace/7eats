export type DishStatus = "active" | "inactive" | "draft";

/** Legacy DB values mapped to the current active/inactive/draft model. */
export function normalizeDishStatus(raw: string): DishStatus {
  if (raw === "draft") return "draft";
  if (raw === "inactive" || raw === "archived") return "inactive";
  return "active";
}

export function isDishPaused(raw: string): boolean {
  return raw === "inactive" || raw === "archived";
}

export function isDishDraft(raw: string): boolean {
  return normalizeDishStatus(raw) === "draft";
}

/** Only active meals can be ordered / appear in browse. */
export function isDishOrderable(raw: string): boolean {
  return normalizeDishStatus(raw) === "active";
}
