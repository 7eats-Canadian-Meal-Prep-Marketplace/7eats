ALTER TABLE "orders" ADD COLUMN "lead_time_snapshot" "lead_time_enum";
ALTER TABLE "orders" ADD COLUMN "lead_time_cutoff_snapshot" time(0);
