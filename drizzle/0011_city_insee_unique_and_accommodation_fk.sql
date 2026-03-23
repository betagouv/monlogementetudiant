-- 1. Unique functional index on the first element of insee_codes array
CREATE UNIQUE INDEX "territories_city_insee_code_unique"
  ON "territories_city" ((insee_codes[1]));--> statement-breakpoint

-- 2. Add city_id column on accommodations referencing territories_city
ALTER TABLE "accommodation_accommodation"
  ADD COLUMN "city_id" bigint;--> statement-breakpoint
ALTER TABLE "accommodation_accommodation"
  ADD CONSTRAINT "accommodation_accommodation_city_id_territories_city_id_fk"
  FOREIGN KEY ("city_id") REFERENCES "public"."territories_city"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- 3. Index on city_id for query performance
CREATE INDEX "accommodation_city_id_idx"
  ON "accommodation_accommodation" USING btree ("city_id");--> statement-breakpoint

-- 4. Populate city_id by matching on city name
UPDATE "accommodation_accommodation" a
  SET "city_id" = c."id"
  FROM "territories_city" c
  WHERE a."city" = c."name";
