CREATE TYPE "public"."bailleur_permission" AS ENUM('manage_users', 'manage_residences', 'manage_availability', 'manage_applications');--> statement-breakpoint
CREATE TYPE "public"."bailleur_role" AS ENUM('administrator', 'gestionnaire');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "bailleur_role" "bailleur_role";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "bailleur_permissions" "bailleur_permission"[] DEFAULT ARRAY[]::bailleur_permission[] NOT NULL;--> statement-breakpoint
UPDATE "user" SET "bailleur_role" = 'administrator' WHERE "role" = 'owner';
