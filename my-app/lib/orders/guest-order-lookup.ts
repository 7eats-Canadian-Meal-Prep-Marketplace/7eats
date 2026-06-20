import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authUser, cookProfiles, orderDishes, orders } from "@/db/schema";
import {
  guestAccessTokensMatch,
  hashGuestAccessToken,
} from "@/lib/guest-order-access";

export type GuestOrderView = {
  id: string;
  confirmationCode: string;
  status: string;
  totalPrice: string;
  currency: string;
  fulfillmentMode: string | null;
  notes: string | null;
  cancellationAllowed: boolean;
  cookName: string;
  dishes: { dishName: string; quantity: number; lineTotal: string }[];
  createdAt: string;
};

export async function getGuestOrderByToken(
  accessToken: string,
): Promise<GuestOrderView | null> {
  const token = accessToken.trim();
  if (!token) return null;

  const tokenHash = hashGuestAccessToken(token);

  const [row] = await db
    .select({
      id: orders.id,
      confirmationCode: orders.confirmationCode,
      status: orders.status,
      totalPrice: orders.totalPrice,
      currency: orders.currency,
      fulfillmentMode: orders.fulfillmentMode,
      notes: orders.notes,
      cancellationAllowed: orders.cancellationAllowed,
      guestAccessTokenHash: orders.guestAccessTokenHash,
      createdAt: orders.createdAt,
      cookFirstName: authUser.firstName,
      cookLastName: authUser.lastName,
      cookDisplayName: cookProfiles.displayName,
    })
    .from(orders)
    .leftJoin(cookProfiles, eq(orders.cookId, cookProfiles.id))
    .leftJoin(authUser, eq(cookProfiles.userId, authUser.id))
    .where(eq(orders.guestAccessTokenHash, tokenHash))
    .limit(1);

  if (
    !row?.guestAccessTokenHash ||
    !guestAccessTokensMatch(token, row.guestAccessTokenHash)
  ) {
    return null;
  }

  const dishRows = await db
    .select({
      dishName: orderDishes.dishName,
      quantity: orderDishes.quantity,
      lineTotal: orderDishes.lineTotal,
    })
    .from(orderDishes)
    .where(eq(orderDishes.orderId, row.id));

  const cookName =
    row.cookDisplayName ||
    [row.cookFirstName, row.cookLastName].filter(Boolean).join(" ") ||
    "Your cook";

  return {
    id: row.id,
    confirmationCode: row.confirmationCode ?? "",
    status: row.status,
    totalPrice: row.totalPrice,
    currency: row.currency,
    fulfillmentMode: row.fulfillmentMode,
    notes: row.notes,
    cancellationAllowed: row.cancellationAllowed,
    cookName,
    dishes: dishRows,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}
