CREATE INDEX "dishes_cook_id_idx" ON "dishes" USING btree ("cook_id");--> statement-breakpoint
CREATE INDEX "orders_client_id_idx" ON "orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "orders_cook_id_idx" ON "orders" USING btree ("cook_id");--> statement-breakpoint
CREATE INDEX "reviews_cook_id_idx" ON "reviews" USING btree ("cook_id");--> statement-breakpoint
ALTER POLICY "dish_promotions_select_own" ON "dish_promotions" TO public USING (dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      ));--> statement-breakpoint
ALTER POLICY "dish_promotions_insert_own" ON "dish_promotions" TO public WITH CHECK (dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      ));--> statement-breakpoint
ALTER POLICY "dish_promotions_update_own" ON "dish_promotions" TO public USING (dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      )) WITH CHECK (dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      ));--> statement-breakpoint
ALTER POLICY "dish_promotions_delete_own" ON "dish_promotions" TO public USING (dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      ));