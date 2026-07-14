-- Re-add draft to dish_status for unfinished meals (cross-device resume).
ALTER TYPE "public"."dish_status" ADD VALUE IF NOT EXISTS 'draft';
