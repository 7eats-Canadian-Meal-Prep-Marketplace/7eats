import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { authUser, cookProfiles, orderDishes, orders } from "@/db/schema";
import {
  guestAccessTokensMatch,
  hashGuestAccessToken,
} from "@/lib/guest-order-access";
import { resolveOrderLeadTimeRules } from "@/lib/lead-time";
import { formatOrderTimingLabel } from "@/lib/order-timing-label";
import { getClientCancelPolicy } from "@/lib/orders/client-cancel-policy";
import { getTaxLabel } from "@/lib/tax";

export type GuestOrderView = {
  id: string;
  confirmationCode: string;
  status: string;
  subtotal: string;
  deliveryFee: string | null;
  platformDiscountAmount: string | null;
  taxAmount: string | null;
  taxLabel: string | null;
  totalPrice: string;
  currency: string;
  fulfillmentMode: string | null;
  timingLabel: string;
  notes: string | null;
  deliveryDetails: string | null;
  cancellationAllowed: boolean;
  cancellable: boolean;
  refundEligible: boolean;
  refundDeadlineLabel: string | null;
  cancelSummary: string;
  cancelDetail: string;
  cancelModalReminder: string;
  /** False when the order owner upgraded from guest to a full account. */
  ownerHasAccount: boolean;
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
      clientId: orders.clientId,
      confirmationCode: orders.confirmationCode,
      status: orders.status,
      totalPrice: orders.totalPrice,
      currency: orders.currency,
      fulfillmentMode: orders.fulfillmentMode,
      pickupAt: orders.pickupAt,
      fulfillmentWindowStart: orders.fulfillmentWindowStart,
      fulfillmentWindowEnd: orders.fulfillmentWindowEnd,
      deliveryFeeSnapshot: orders.deliveryFeeSnapshot,
      platformDiscountAmount: orders.platformDiscountAmount,
      taxAmount: orders.taxAmount,
      taxProvince: orders.taxProvince,
      notes: orders.notes,
      deliveryDetails: orders.deliveryDetails,
      cancellationAllowed: orders.cancellationAllowed,
      guestAccessTokenHash: orders.guestAccessTokenHash,
      createdAt: orders.createdAt,
      leadTimeSnapshot: orders.leadTimeSnapshot,
      leadTimeCutoffSnapshot: orders.leadTimeCutoffSnapshot,
      cookFirstName: authUser.firstName,
      cookLastName: authUser.lastName,
      cookDisplayName: cookProfiles.displayName,
      cookLeadTime: cookProfiles.leadTime,
      cookLeadTimeCutoff: cookProfiles.leadTimeCutoff,
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
      priceSnapshot: orderDishes.priceSnapshot,
      discountAmount: orderDishes.discountAmount,
      lineTotal: orderDishes.lineTotal,
      sortOrder: orderDishes.sortOrder,
    })
    .from(orderDishes)
    .where(eq(orderDishes.orderId, row.id))
    .orderBy(asc(orderDishes.sortOrder));

  const dishes = dishRows.map((d) => {
    const parsedLine = Number.parseFloat(d.lineTotal);
    let lineTotal = Number.isFinite(parsedLine) ? parsedLine : 0;
    if (lineTotal <= 0) {
      const price = Number.parseFloat(d.priceSnapshot);
      const qty = d.quantity ?? 1;
      const discount = d.discountAmount
        ? Number.parseFloat(d.discountAmount)
        : 0;
      if (Number.isFinite(price) && price > 0) {
        lineTotal = Math.max(0, price * qty - discount);
      }
    }
    return {
      dishName: d.dishName,
      quantity: d.quantity,
      lineTotal: lineTotal.toFixed(2),
    };
  });

  const cookName =
    row.cookDisplayName ||
    [row.cookFirstName, row.cookLastName].filter(Boolean).join(" ") ||
    "Your cook";

  const subtotal = dishes.reduce(
    (sum, d) => sum + Number.parseFloat(d.lineTotal),
    0,
  );

  const fulfillmentMode =
    row.fulfillmentMode === "delivery" || row.fulfillmentMode === "pickup"
      ? row.fulfillmentMode
      : null;

  const totalPrice = Number.parseFloat(row.totalPrice);
  const taxAmountNum = row.taxAmount ? Number.parseFloat(row.taxAmount) : 0;
  const platformDiscountNum = row.platformDiscountAmount
    ? Number.parseFloat(row.platformDiscountAmount)
    : 0;
  let deliveryFee = row.deliveryFeeSnapshot;
  if (
    fulfillmentMode === "delivery" &&
    !deliveryFee &&
    subtotal > 0 &&
    Number.isFinite(totalPrice) &&
    totalPrice > 0
  ) {
    // total = subtotal + delivery − discount + tax, so back out delivery by
    // adding the discount in again.
    const derived = Math.max(
      0,
      Math.round(
        (totalPrice + platformDiscountNum - taxAmountNum - subtotal) * 100,
      ) / 100,
    );
    if (derived > 0) deliveryFee = derived.toFixed(2);
  }

  const [clientRow] = await db
    .select({ isGuestAccount: authUser.isGuestAccount })
    .from(authUser)
    .where(eq(authUser.id, row.clientId))
    .limit(1);
  const ownerHasAccount = clientRow ? !clientRow.isGuestAccount : false;

  return {
    id: row.id,
    confirmationCode: row.confirmationCode ?? "",
    status: row.status,
    subtotal: subtotal.toFixed(2),
    deliveryFee,
    platformDiscountAmount: row.platformDiscountAmount,
    taxAmount: row.taxAmount,
    taxLabel: row.taxProvince ? getTaxLabel(row.taxProvince) : null,
    totalPrice: row.totalPrice,
    currency: row.currency,
    fulfillmentMode: row.fulfillmentMode,
    timingLabel: formatOrderTimingLabel({
      pickupAt: row.pickupAt,
      fulfillmentWindowStart: row.fulfillmentWindowStart,
      fulfillmentWindowEnd: row.fulfillmentWindowEnd,
      fulfillmentMode,
    }),
    notes: row.notes,
    deliveryDetails: row.deliveryDetails,
    ...(() => {
      const leadTimeRules = resolveOrderLeadTimeRules(row);
      const cancelPolicy = getClientCancelPolicy({
        status: row.status,
        cancellationAllowed: row.cancellationAllowed,
        pickupAt: row.pickupAt,
        fulfillmentWindowStart: row.fulfillmentWindowStart,
        cookLeadTime: leadTimeRules.leadTime,
        cookLeadTimeCutoff: leadTimeRules.leadTimeCutoff,
        fulfillmentMode,
      });
      return {
        cancellationAllowed: row.cancellationAllowed,
        cancellable: cancelPolicy.cancellable,
        refundEligible: cancelPolicy.refundEligible,
        refundDeadlineLabel: cancelPolicy.refundDeadlineLabel,
        cancelSummary: cancelPolicy.summary,
        cancelDetail: cancelPolicy.detail,
        cancelModalReminder: cancelPolicy.modalReminder,
      };
    })(),
    ownerHasAccount,
    cookName,
    dishes,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}
