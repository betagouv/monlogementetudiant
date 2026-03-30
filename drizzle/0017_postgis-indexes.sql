-- Add spatial GIST indexes on boundary columns for ST_DWithin performance
CREATE INDEX IF NOT EXISTS idx_cities_boundary_gist ON territories_city USING GIST (boundary); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_departments_boundary_gist ON territories_department USING GIST (boundary); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_academies_boundary_gist ON territories_academy USING GIST (boundary);
