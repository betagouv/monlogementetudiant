-- Add slug column to academies
ALTER TABLE territories_academy ADD COLUMN slug varchar(255); --> statement-breakpoint
UPDATE territories_academy SET slug = LOWER(REPLACE(name, ' ', '-')); --> statement-breakpoint
ALTER TABLE territories_academy ALTER COLUMN slug SET NOT NULL; --> statement-breakpoint
ALTER TABLE territories_academy ADD CONSTRAINT territories_academy_slug_unique UNIQUE(slug); --> statement-breakpoint

-- Add slug column to departments
ALTER TABLE territories_department ADD COLUMN slug varchar(255); --> statement-breakpoint
UPDATE territories_department SET name = 'Guadeloupe' WHERE code = '971' AND (name IS NULL OR name = ''); --> statement-breakpoint
UPDATE territories_department SET name = 'Martinique' WHERE code = '972' AND (name IS NULL OR name = ''); --> statement-breakpoint
UPDATE territories_department SET name = 'Guyane' WHERE code = '973' AND (name IS NULL OR name = ''); --> statement-breakpoint
UPDATE territories_department SET name = 'La Réunion' WHERE code = '974' AND (name IS NULL OR name = ''); --> statement-breakpoint
UPDATE territories_department SET name = 'Mayotte' WHERE code = '976' AND (name IS NULL OR name = ''); --> statement-breakpoint
UPDATE territories_department SET slug = LOWER(REPLACE(name, ' ', '-')); --> statement-breakpoint
ALTER TABLE territories_department ALTER COLUMN slug SET NOT NULL; --> statement-breakpoint
ALTER TABLE territories_department ADD CONSTRAINT territories_department_slug_unique UNIQUE(slug); --> statement-breakpoint

-- Drop denormalized city column (city_id FK already exists)
ALTER TABLE accommodation_accommodation DROP COLUMN city;
