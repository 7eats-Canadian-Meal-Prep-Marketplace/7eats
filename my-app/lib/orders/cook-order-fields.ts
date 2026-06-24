/** Cook identity + media fields shared by client order API responses. */

export type OrderCookRow = {
  cookDisplayName?: string | null;
  cookFirstName?: string | null;
  cookLastName?: string | null;
  cookPhotoUrl?: string | null;
  cookBannerUrl?: string | null;
};

export function resolveOrderCookFields(row: OrderCookRow) {
  const cookName =
    row.cookDisplayName?.trim() ||
    [row.cookFirstName, row.cookLastName].filter(Boolean).join(" ") ||
    null;

  const initialsSource = cookName ?? "";
  const cookInitials =
    initialsSource
      .split(/\s+/)
      .map((word) => word[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || null;

  return {
    cookName,
    cookInitials,
    cookPhotoUrl: row.cookPhotoUrl ?? null,
    cookBannerUrl: row.cookBannerUrl ?? null,
  };
}
