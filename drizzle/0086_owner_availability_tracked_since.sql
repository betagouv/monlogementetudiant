ALTER TABLE "owner" ADD COLUMN "availability_tracked_since" timestamp with time zone;--> statement-breakpoint
UPDATE "owner" SET "availability_imported" = false, "availability_tracked_since" = now() WHERE "availability_imported" AND "slug" NOT IN ('crous', 'fac-habitat', 'arpej', 'initiall');
