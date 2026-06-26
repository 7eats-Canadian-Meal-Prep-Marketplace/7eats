import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, dbPool } from "@/db";
import {
  authAccount,
  authSession,
  authUser,
  authUserTable,
  followedCooks,
  orders,
  reviews,
  savedListings,
  userAddresses,
  userPreferences,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  BLOCKING_ORDER_STATUSES,
  DELETED_ACCOUNT_DISPLAY_NAME,
  tombstoneEmail,
} from "@/lib/client-account-deletion-policy";
import { sendAccountDeletedEmail } from "@/lib/emails/account-deletion";
import {
  detachCustomerPaymentMethod,
  listCustomerCards,
} from "@/lib/payment-methods";
import { formatReviewerDisplayName } from "@/lib/reviews/display-name";
import { avatarKeyFromUrl, deleteAvatar } from "@/lib/storage/avatars";

export {
  BLOCKING_ORDER_STATUSES,
  DELETED_ACCOUNT_DISPLAY_NAME,
  tombstoneEmail,
} from "@/lib/client-account-deletion-policy";

export type DeleteEligibility = {
  eligible: boolean;
  blockingOrders: Array<{ id: string; status: string }>;
};

export async function getClientDeleteEligibility(
  userId: string,
): Promise<DeleteEligibility> {
  const blockingOrders = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(
      and(
        eq(orders.clientId, userId),
        inArray(orders.status, [...BLOCKING_ORDER_STATUSES]),
      ),
    );

  return {
    eligible: blockingOrders.length === 0,
    blockingOrders: blockingOrders.map((row) => ({
      id: row.id,
      status: row.status,
    })),
  };
}

export async function verifyClientPassword(
  userId: string,
  password: string,
): Promise<boolean> {
  const [cred] = await db
    .select({ password: authAccount.password })
    .from(authAccount)
    .where(
      and(
        eq(authAccount.userId, userId),
        eq(authAccount.providerId, "credential"),
      ),
    )
    .limit(1);

  if (!cred?.password) return false;

  const ctx = await auth.$context;
  return ctx.password.verify({ password, hash: cred.password });
}

async function detachStripePaymentMethods(stripeCustomerId: string | null) {
  if (!stripeCustomerId) return;
  try {
    const cards = await listCustomerCards(stripeCustomerId);
    await Promise.all(
      cards.map((card) =>
        detachCustomerPaymentMethod(stripeCustomerId, card.id).catch((err) => {
          console.error("[client-account-deletion] detach card", card.id, err);
        }),
      ),
    );
  } catch (err) {
    console.error("[client-account-deletion] stripe cleanup", err);
  }
}

export async function deleteClientAccount(userId: string): Promise<void> {
  const eligibility = await getClientDeleteEligibility(userId);
  if (!eligibility.eligible) {
    throw new Error("ACTIVE_ORDERS");
  }

  const [user] = await db
    .select({
      email: authUser.email,
      firstName: authUser.firstName,
      lastName: authUser.lastName,
      image: authUser.image,
      stripeCustomerId: authUser.stripeCustomerId,
      status: authUser.status,
    })
    .from(authUser)
    .where(eq(authUser.id, userId))
    .limit(1);

  if (!user) throw new Error("NOT_FOUND");
  if (user.status === "deleted") throw new Error("ALREADY_DELETED");

  const notifyEmail = user.email;
  const notifyFirstName = user.firstName;
  const frozenReviewerName = formatReviewerDisplayName(
    user.firstName,
    user.lastName,
  );

  const imageKey = user.image ? avatarKeyFromUrl(user.image) : null;
  await detachStripePaymentMethods(user.stripeCustomerId);

  await dbPool.transaction(async (tx) => {
    await tx.delete(userPreferences).where(eq(userPreferences.userId, userId));
    await tx.delete(userAddresses).where(eq(userAddresses.userId, userId));
    await tx.delete(followedCooks).where(eq(followedCooks.userId, userId));
    await tx.delete(savedListings).where(eq(savedListings.userId, userId));
    // Keep the public name + comment they chose at review time; only backfill
    // rows that predate the reviewerDisplayName snapshot column.
    await tx
      .update(reviews)
      .set({
        reviewerDisplayName: frozenReviewerName,
        updatedAt: new Date(),
      })
      .where(
        and(eq(reviews.clientId, userId), isNull(reviews.reviewerDisplayName)),
      );
    await tx.delete(authSession).where(eq(authSession.userId, userId));
    await tx.delete(authAccount).where(eq(authAccount.userId, userId));

    await tx
      .update(authUserTable)
      .set({
        status: "deleted",
        email: tombstoneEmail(userId),
        emailVerified: false,
        name: DELETED_ACCOUNT_DISPLAY_NAME,
        firstName: DELETED_ACCOUNT_DISPLAY_NAME,
        lastName: null,
        phone: null,
        phoneVerified: false,
        image: null,
        neighborhood: null,
        dateOfBirth: null,
        notificationPreferences: null,
        onboardingCompletedAt: null,
        isGuestAccount: false,
        updatedAt: new Date(),
      })
      .where(eq(authUser.id, userId));
  });

  if (imageKey) {
    try {
      await deleteAvatar(imageKey);
    } catch (err) {
      console.error("[client-account-deletion] avatar delete", err);
    }
  }

  await sendAccountDeletedEmail(notifyEmail, notifyFirstName);
}
