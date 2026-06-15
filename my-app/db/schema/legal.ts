import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { cookApplications } from "./applications";
import { authUser } from "./auth";
import { legalAcceptanceContext } from "./enums";

const isAdmin = sql`auth.role() = 'admin'`;
const isService = sql`auth.role() = 'service_role'`;

// Append-only audit trail of clickwrap acceptances. One row per acceptance
// event. `userId` is set for client signup and guest checkout; `applicationId`
// is set for cook applications (which have no user account yet). `version` and
// `documents` capture exactly which policies — and which revision — the person
// agreed to, so we can prove consent even after the policies change.
export const legalAcceptances = pgTable(
  "legal_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => authUser.id, {
      onDelete: "cascade",
    }),
    applicationId: uuid("application_id").references(
      () => cookApplications.id,
      {
        onDelete: "cascade",
      },
    ),
    context: legalAcceptanceContext("context").notNull(),
    version: text("version").notNull(),
    documents: jsonb("documents").$type<string[]>().notNull(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("legal_acceptances_user_id_idx").on(table.userId),
    index("legal_acceptances_application_id_idx").on(table.applicationId),
    pgPolicy("legal_acceptances_insert_service", {
      for: "insert",
      to: "public",
      withCheck: isService,
    }),
    pgPolicy("legal_acceptances_select_own", {
      for: "select",
      to: "public",
      using: sql`user_id = auth.uid()::text`,
    }),
    pgPolicy("legal_acceptances_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("legal_acceptances_select_service", {
      for: "select",
      to: "public",
      using: isService,
    }),
  ],
).enableRLS();
