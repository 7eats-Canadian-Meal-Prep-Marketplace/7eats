import { DELETED_ACCOUNT_DISPLAY_NAME } from "@/lib/client-account-deletion-policy";

export type CookClientOrderFields = {
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerName?: string | null;
  clientAccountStatus?: string | null;
  isGuestCheckout?: boolean;
  clientIsGuestAccount?: boolean;
};

/** Plain customer name for cook-facing order UI (no status tags). */
export function cookClientDisplayName(order: CookClientOrderFields): string {
  const first = order.customerFirstName?.trim();
  const last = order.customerLastName?.trim();

  // Legacy rows scrubbed before we kept names on delete.
  if (first === DELETED_ACCOUNT_DISPLAY_NAME) {
    return DELETED_ACCOUNT_DISPLAY_NAME;
  }

  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;

  const name = order.customerName?.trim();
  if (name && name !== DELETED_ACCOUNT_DISPLAY_NAME) return name;

  return "Customer";
}

export function isCookClientDeleted(
  order: Pick<
    CookClientOrderFields,
    "clientAccountStatus" | "customerFirstName"
  >,
): boolean {
  return (
    order.clientAccountStatus === "deleted" ||
    order.customerFirstName === DELETED_ACCOUNT_DISPLAY_NAME
  );
}

export function isCookClientGuest(order: CookClientOrderFields): boolean {
  return Boolean(order.isGuestCheckout || order.clientIsGuestAccount);
}
