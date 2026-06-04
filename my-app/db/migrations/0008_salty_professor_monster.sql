CREATE TYPE "public"."notification_entity_type" AS ENUM('order_new', 'order_cancelled', 'review');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('full', 'deposit', 'balance');--> statement-breakpoint
CREATE TABLE "cook_pickup_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cook_id" uuid NOT NULL,
	"day_of_week" text NOT NULL,
	"from_time" time(0) NOT NULL,
	"to_time" time(0) NOT NULL,
	CONSTRAINT "cpw_time_order" CHECK ("cook_pickup_windows"."to_time" > "cook_pickup_windows"."from_time"),
	CONSTRAINT "cpw_day_valid" CHECK ("cook_pickup_windows"."day_of_week" IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday'))
);
--> statement-breakpoint
ALTER TABLE "cook_pickup_windows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cook_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"order_id" uuid,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_role" text NOT NULL,
	"body" text NOT NULL,
	"is_read_by_cook" boolean DEFAULT false NOT NULL,
	"is_read_by_client" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cook_notification_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cook_id" uuid NOT NULL,
	"entity_type" "notification_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cook_notification_reads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_payments" DROP CONSTRAINT "order_payments_order_id_unique";--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "deposit_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "deposit_type" "late_cancel_fee_type";--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "deposit_value" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit_type" "late_cancel_fee_type";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit_value" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "order_payments" ADD COLUMN "type" "payment_type" DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "cook_pickup_windows" ADD CONSTRAINT "cook_pickup_windows_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_notification_reads" ADD CONSTRAINT "cook_notification_reads_cook_id_cook_profiles_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cook_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cpw_cook_day_uidx" ON "cook_pickup_windows" USING btree ("cook_id","day_of_week");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_cook_client_order_uidx" ON "conversations" USING btree ("cook_id","client_id","order_id") WHERE "conversations"."order_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "conversations_cook_id_idx" ON "conversations" USING btree ("cook_id");--> statement-breakpoint
CREATE INDEX "conversations_last_message_at_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cook_notif_reads_cook_entity_uidx" ON "cook_notification_reads" USING btree ("cook_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_payments_order_type_uidx" ON "order_payments" USING btree ("order_id","type");--> statement-breakpoint
ALTER TABLE "cook_profiles" DROP COLUMN "pickup_days";--> statement-breakpoint
ALTER TABLE "cook_profiles" DROP COLUMN "pickup_from";--> statement-breakpoint
ALTER TABLE "cook_profiles" DROP COLUMN "pickup_to";--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_deposit_value_positive" CHECK ("listings"."deposit_value" IS NULL OR "listings"."deposit_value" > 0);--> statement-breakpoint
CREATE POLICY "cpw_select_public" ON "cook_pickup_windows" AS PERMISSIVE FOR SELECT TO public USING (EXISTS (
        SELECT 1 FROM cook_profiles cp
        INNER JOIN "user" u ON u.id = cp.user_id
        WHERE cp.id = cook_pickup_windows.cook_id AND u.status = 'active'
      ));--> statement-breakpoint
CREATE POLICY "cpw_insert_own" ON "cook_pickup_windows" AS PERMISSIVE FOR INSERT TO public WITH CHECK (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "cpw_update_own" ON "cook_pickup_windows" AS PERMISSIVE FOR UPDATE TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())) WITH CHECK (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "cpw_delete_own" ON "cook_pickup_windows" AS PERMISSIVE FOR DELETE TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "cpw_all_admin" ON "cook_pickup_windows" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'admin');--> statement-breakpoint
CREATE POLICY "conversations_select_cook" ON "conversations" AS PERMISSIVE FOR SELECT TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "conversations_select_client" ON "conversations" AS PERMISSIVE FOR SELECT TO public USING (client_id = auth.uid()::text);--> statement-breakpoint
CREATE POLICY "conversations_insert_service" ON "conversations" AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');--> statement-breakpoint
CREATE POLICY "conversations_update_cook" ON "conversations" AS PERMISSIVE FOR UPDATE TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "messages_select_cook" ON "messages" AS PERMISSIVE FOR SELECT TO public USING (conversation_id IN (
        SELECT id FROM conversations
        WHERE cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text)
      ));--> statement-breakpoint
CREATE POLICY "messages_select_client" ON "messages" AS PERMISSIVE FOR SELECT TO public USING (conversation_id IN (
        SELECT id FROM conversations WHERE client_id = auth.uid()::text
      ));--> statement-breakpoint
CREATE POLICY "messages_insert_cook" ON "messages" AS PERMISSIVE FOR INSERT TO public WITH CHECK (
        sender_role = 'cook'
        AND conversation_id IN (
          SELECT id FROM conversations
          WHERE cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text)
        )
      );--> statement-breakpoint
CREATE POLICY "messages_insert_client" ON "messages" AS PERMISSIVE FOR INSERT TO public WITH CHECK (
        sender_role = 'client'
        AND conversation_id IN (
          SELECT id FROM conversations WHERE client_id = auth.uid()::text
        )
      );--> statement-breakpoint
CREATE POLICY "messages_update_cook" ON "messages" AS PERMISSIVE FOR UPDATE TO public USING (conversation_id IN (
        SELECT id FROM conversations
        WHERE cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text)
      ));--> statement-breakpoint
CREATE POLICY "messages_update_client" ON "messages" AS PERMISSIVE FOR UPDATE TO public USING (conversation_id IN (
        SELECT id FROM conversations WHERE client_id = auth.uid()::text
      ));--> statement-breakpoint
CREATE POLICY "notif_reads_select_own" ON "cook_notification_reads" AS PERMISSIVE FOR SELECT TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "notif_reads_insert_own" ON "cook_notification_reads" AS PERMISSIVE FOR INSERT TO public WITH CHECK (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "notif_reads_delete_own" ON "cook_notification_reads" AS PERMISSIVE FOR DELETE TO public USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text));--> statement-breakpoint
CREATE POLICY "notif_reads_all_admin" ON "cook_notification_reads" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'admin');