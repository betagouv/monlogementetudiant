-- Guard: ensure required PostgreSQL extensions exist
-- These are normally already created by PostGIS / Django, this is a safety net.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
