-- Add slug columns to academies and departments
ALTER TABLE territories_academy ADD COLUMN slug varchar(255);
--> statement-breakpoint
UPDATE territories_academy SET slug = LOWER(REPLACE(name, ' ', '-'));
--> statement-breakpoint
ALTER TABLE territories_academy ALTER COLUMN slug SET NOT NULL;
--> statement-breakpoint
ALTER TABLE territories_academy ADD CONSTRAINT territories_academy_slug_unique UNIQUE(slug);
--> statement-breakpoint

ALTER TABLE territories_department ADD COLUMN slug varchar(255);
--> statement-breakpoint
UPDATE territories_department SET slug = LOWER(REPLACE(name, ' ', '-'));
--> statement-breakpoint
ALTER TABLE territories_department ALTER COLUMN slug SET NOT NULL;
--> statement-breakpoint
ALTER TABLE territories_department ADD CONSTRAINT territories_department_slug_unique UNIQUE(slug);
--> statement-breakpoint

-- Drop denormalized city column (city_id FK already exists)
ALTER TABLE accommodation_accommodation DROP COLUMN city;
