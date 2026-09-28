CREATE TYPE "public"."applications_suspension_reason" AS ENUM('manual', 'unprocessed_applications', 'stale_availability');--> statement-breakpoint
ALTER TABLE "accommodation" ADD COLUMN "applications_suspension_reason" "applications_suspension_reason";--> statement-breakpoint
ALTER TABLE "accommodation" ADD COLUMN "unprocessed_applications_warned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accommodation" ADD COLUMN "stale_availability_warned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "owner" ADD COLUMN "availability_imported" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "accommodation" SET "applications_suspension_reason" = 'manual' WHERE "applications_suspended_at" IS NOT NULL;--> statement-breakpoint
UPDATE "owner" SET "availability_imported" = true WHERE "slug" IN ('arpej', 'fac-habitat', 'initiall') OR "id" IN (SELECT DISTINCT "owner_id" FROM "accommodation" WHERE "external_reference" IS NOT NULL AND "owner_id" IS NOT NULL);
