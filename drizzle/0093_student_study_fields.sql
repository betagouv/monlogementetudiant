CREATE TYPE "public"."study_year" AS ENUM('bac_1', 'bac_2', 'bac_3', 'bac_4', 'bac_5_plus');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_work_study" boolean;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "study_institution" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "study_year" "study_year";--> statement-breakpoint
ALTER TABLE "contact_request" ADD COLUMN "is_work_study" boolean;--> statement-breakpoint
ALTER TABLE "contact_request" ADD COLUMN "study_institution" text;--> statement-breakpoint
ALTER TABLE "contact_request" ADD COLUMN "study_year" "study_year";