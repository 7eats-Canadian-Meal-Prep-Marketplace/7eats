CREATE TYPE "notification_entity_type" AS ENUM('order_new', 'order_cancelled', 'review');

CREATE TABLE "cook_notification_reads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cook_id" uuid NOT NULL REFERENCES "cook_profiles"("id") ON DELETE CASCADE,
  "entity_type" "notification_entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "read_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "cook_notif_reads_cook_entity_uidx" UNIQUE ("cook_id", "entity_type", "entity_id")
);

ALTER TABLE "cook_notification_reads" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_reads_select_own" ON "cook_notification_reads"
  FOR SELECT TO public
  USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text));

CREATE POLICY "notif_reads_insert_own" ON "cook_notification_reads"
  FOR INSERT TO public
  WITH CHECK (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text));

CREATE POLICY "notif_reads_delete_own" ON "cook_notification_reads"
  FOR DELETE TO public
  USING (cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text));

CREATE POLICY "notif_reads_all_admin" ON "cook_notification_reads"
  FOR ALL TO public
  USING (auth.role() = 'admin');
