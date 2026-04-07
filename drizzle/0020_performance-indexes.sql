-- Index trigram GIN pour les recherches ILIKE sur le nom de ville
CREATE INDEX IF NOT EXISTS idx_cities_name_trgm
  ON territories_city
  USING GIN (immutable_unaccent(name) gin_trgm_ops);--> statement-breakpoint

-- Index B-tree sur le nom normalisé pour le match exact (fallback centroid)
CREATE INDEX IF NOT EXISTS idx_cities_name_unaccent
  ON territories_city (LOWER(immutable_unaccent(name)));--> statement-breakpoint

-- Index partiel pour les villes populaires
CREATE INDEX IF NOT EXISTS idx_cities_popular
  ON territories_city (name)
  WHERE popular = true;--> statement-breakpoint

-- Index partiels pour les agrégations accommodation par city_id
CREATE INDEX IF NOT EXISTS accommodation_city_published_available_idx
  ON accommodation_accommodation USING btree (city_id)
  WHERE published = true AND available = true;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS accommodation_city_published_available_price_idx
  ON accommodation_accommodation USING btree (city_id, price_min)
  WHERE published = true AND available = true AND price_min IS NOT NULL;
