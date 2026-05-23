import { pgEnum } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["client", "cook", "admin"]);
export const accountStatus = pgEnum("account_status", [
  "pending",
  "active",
  "suspended",
  "banned",
]);
export const listingStatus = pgEnum("listing_status", [
  "draft",
  "pending_review",
  "active",
  "archived",
]);
export const orderStatus = pgEnum("order_status", [
  "pending",
  "confirmed",
  "ready",
  "fulfilled",
  "cancelled",
]);
export const certificationStatus = pgEnum("certification_status", [
  "pending_review",
  "approved",
  "rejected",
]);
