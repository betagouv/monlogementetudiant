-- Restore search indexes that were lost or invalidated on dev after migrations
-- 0024 (drop available column → cascade-dropped 0020 partial indexes)
-- and 0029 (move city_id from accommodation_accommodation to accommodation_address).

-- Trigram GIN index for ILIKE '%...%' searches on city name (autocomplete bottleneck).
DROP INDEX IF EXISTS idx_cities_name_trgm;--> statement-breakpoint
CREATE INDEX idx_cities_name_trgm
  ON territories_city
  USING GIN (immutable_unaccent(name) gin_trgm_ops);--> statement-breakpoint

-- B-tree on the normalised name for exact match / prefix.
DROP INDEX IF EXISTS idx_cities_name_unaccent;--> statement-breakpoint
CREATE INDEX idx_cities_name_unaccent
  ON territories_city (LOWER(immutable_unaccent(name)));--> statement-breakpoint

-- Replacement for accommodation_city_published_available_idx (cascade-dropped by 0024).
-- Covering index so cityAccommodationStatsSubquery can do an Index-Only Scan filtered on published.
CREATE INDEX IF NOT EXISTS accommodation_published_idx
  ON accommodation_accommodation (id, owner_id, nb_total_apartments, price_min)
  WHERE published = true;--> statement-breakpoint

-- Composite index supporting the join + GROUP BY in cityAccommodationStatsSubquery
-- (the existing accommodation_address_city_id_idx is single-column and does not cover the join).
CREATE INDEX IF NOT EXISTS accommodation_address_city_accommodation_idx
  ON accommodation_address (city_id, accommodation_id);--> statement-breakpoint

-- GIN indexes on city code arrays for postal/INSEE lookups (resolve-city, geocoder).
-- Required so `postal_codes @> ARRAY[$1]` and `insee_codes @> ARRAY[$1]` can use an index.
-- The previous `= ANY(...)` form cannot leverage a GIN array index — forces a Seq Scan on the 17k cities.
CREATE INDEX IF NOT EXISTS territories_city_postal_codes_gin_idx
  ON territories_city USING GIN (postal_codes);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS territories_city_insee_codes_gin_idx
  ON territories_city USING GIN (insee_codes);
