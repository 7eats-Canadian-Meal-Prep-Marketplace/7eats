-- Allow placeholder price 0 on draft meals (name-only drafts before pricing).
ALTER TABLE "dishes" DROP CONSTRAINT IF EXISTS "dishes_price_positive";
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_price_positive" CHECK (
  (status = 'draft' AND price >= 0) OR (status <> 'draft' AND price > 0)
);
