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
export const applicationStatus = pgEnum("application_status", [
  "pending_review",
  "approved",
  "rejected",
]);
export const kitchenType = pgEnum("kitchen_type", [
  "licensed_home",
  "commercial_rented",
  "ghost_kitchen",
  "restaurant_cafe",
  "community_kitchen",
  "other",
]);
export const leadTimeEnum = pgEnum("lead_time_enum", [
  "same_day",
  "1_day",
  "2_days",
  "3_days",
  "4_days",
  "5_days",
]);
export const deliveryEnum = pgEnum("delivery_enum", ["none", "self"]);
