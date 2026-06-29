export type DishStatus = "active" | "inactive";

/** Legacy DB values mapped to the current active/inactive model. */
export function normalizeDishStatus(raw: string): DishStatus {
  if (raw === "inactive" || raw === "archived") return "inactive";
  return "active";
}

export function isDishPaused(raw: string): boolean {
  return raw === "inactive" || raw === "archived";
}
