export type NotificationKind = "order" | "review" | "cancelled";

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  timestamp: string;
  href: string;
  isRead: boolean;
  rating?: number;
};

export type OrderNotifRow = {
  id: string;
  createdAt: Date;
  cancelledAt: Date | null;
  listingId: string | null;
  listingTitle: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
};

export type ReviewNotifRow = {
  id: string;
  rating: number;
  createdAt: Date;
  listingId: string | null;
  listingTitle: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
};

const VALID_ENTITY_TYPES = new Set(["order_new", "order_cancelled", "review"]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function customerName(
  firstName: string | null,
  lastName: string | null,
): string {
  return [firstName, lastName].filter(Boolean).join(" ") || "Customer";
}

function detail(name: string, listingTitle: string | null): string {
  return listingTitle ? `${name} · ${listingTitle}` : name;
}

export function buildOrderNewNotif(
  row: OrderNotifRow,
  isRead: boolean,
): Notification {
  const name = customerName(row.customerFirstName, row.customerLastName);
  return {
    id: `order_new:${row.id}`,
    kind: "order",
    title: "New order",
    detail: detail(name, row.listingTitle),
    timestamp: row.createdAt.toISOString(),
    href: "/business/orders",
    isRead,
  };
}

export function buildOrderCancelledNotif(
  row: OrderNotifRow,
  isRead: boolean,
): Notification {
  const name = customerName(row.customerFirstName, row.customerLastName);
  return {
    id: `order_cancelled:${row.id}`,
    kind: "cancelled",
    title: "Order cancelled",
    detail: detail(name, row.listingTitle),
    timestamp: (row.cancelledAt ?? row.createdAt).toISOString(),
    href: "/business/orders",
    isRead,
  };
}

export function buildReviewNotif(
  row: ReviewNotifRow,
  isRead: boolean,
): Notification {
  const name = customerName(row.customerFirstName, row.customerLastName);
  return {
    id: `review:${row.id}`,
    kind: "review",
    title: "New review",
    detail: detail(name, row.listingTitle),
    timestamp: row.createdAt.toISOString(),
    href: `/business/listings/${row.listingId ?? ""}`,
    isRead,
    rating: row.rating,
  };
}

export function parseNotifId(
  id: string,
): { entityType: string; entityId: string } | null {
  const colonIdx = id.indexOf(":");
  if (colonIdx === -1) return null;
  const entityType = id.slice(0, colonIdx);
  const entityId = id.slice(colonIdx + 1);
  if (!VALID_ENTITY_TYPES.has(entityType)) return null;
  if (!UUID_RE.test(entityId)) return null;
  return { entityType, entityId };
}
