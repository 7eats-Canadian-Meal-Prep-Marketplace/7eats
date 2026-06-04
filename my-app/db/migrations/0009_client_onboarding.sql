CREATE TABLE "user_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dietary" json NOT NULL,
	"allergies" json NOT NULL,
	"goals" json NOT NULL,
	"why_meal_prep" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE POLICY "user_prefs_own" ON "user_preferences" AS PERMISSIVE FOR ALL TO public USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
--> statement-breakpoint
CREATE POLICY "user_prefs_admin" ON "user_preferences" AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'admin');
