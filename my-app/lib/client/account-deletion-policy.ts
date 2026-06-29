/** Orders that must finish or be cancelled before a client can delete. */
export const BLOCKING_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "ready",
] as const;

export const DELETED_ACCOUNT_DISPLAY_NAME = "Deleted account";

export function tombstoneEmail(userId: string): string {
  return `deleted.${userId}@deleted.7eats.internal`;
}
