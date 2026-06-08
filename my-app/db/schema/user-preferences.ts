import { sql } from "drizzle-orm";
import {
  doublePrecision,
  pgPolicy,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { authUser } from "./auth";

export const userServiceAddress = pgTable(
  "user_service_address",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => authUser.id, { onDelete: "cascade" }),
    serviceStreet: text("service_street"),
    serviceUnit: text("service_unit"),
    serviceCity: text("service_city"),
    serviceProvince: text("service_province"),
    servicePostal: text("service_postal"),
    serviceLat: doublePrecision("service_lat"),
    serviceLng: doublePrecision("service_lng"),
    servicePlaceId: text("service_place_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  () => [
    pgPolicy("user_service_address_own", {
      for: "all",
      to: "public",
      using: sql`user_id = auth.uid()::text`,
      withCheck: sql`user_id = auth.uid()::text`,
    }),
    pgPolicy("user_service_address_admin", {
      for: "all",
      to: "public",
      using: sql`auth.role() = 'admin'`,
    }),
  ],
).enableRLS();
