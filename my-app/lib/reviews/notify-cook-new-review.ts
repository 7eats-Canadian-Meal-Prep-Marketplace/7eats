import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authUser, cookProfiles, orderDishes, reviews } from "@/db/schema";
import { sendNewReviewEmailToCook } from "@/lib/emails/review-events";

export async function notifyCookNewReview(reviewId: string): Promise<void> {
  const [row] = await db
    .select({
      rating: reviews.rating,
      comment: reviews.comment,
      orderId: reviews.orderId,
      clientFirstName: authUser.firstName,
      clientLastName: authUser.lastName,
      clientEmail: authUser.email,
      cookUserId: cookProfiles.userId,
      emailNotificationsNewReview: cookProfiles.emailNotificationsNewReview,
    })
    .from(reviews)
    .innerJoin(authUser, eq(reviews.clientId, authUser.id))
    .innerJoin(cookProfiles, eq(reviews.cookId, cookProfiles.id))
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!row) return;

  if (!row.emailNotificationsNewReview) return;

  const [cookUser] = await db
    .select({
      email: authUser.email,
      firstName: authUser.firstName,
    })
    .from(authUser)
    .where(eq(authUser.id, row.cookUserId))
    .limit(1);

  if (!cookUser?.email) return;

  const dishRows = await db
    .select({ dishName: orderDishes.dishName })
    .from(orderDishes)
    .where(eq(orderDishes.orderId, row.orderId));

  const orderSummary =
    dishRows.map((d) => d.dishName).join(", ") || "their order";

  const customerName =
    [row.clientFirstName, row.clientLastName].filter(Boolean).join(" ") ||
    row.clientEmail ||
    "A customer";

  await sendNewReviewEmailToCook(
    { email: cookUser.email, firstName: cookUser.firstName },
    {
      customerName,
      orderSummary,
      rating: row.rating,
      comment: row.comment,
    },
  );
}
