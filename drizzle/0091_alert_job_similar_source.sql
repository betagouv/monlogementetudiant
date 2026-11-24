DROP INDEX "alert_job_alert_active_unique";--> statement-breakpoint
DROP INDEX "alert_job_favorite_active_unique";--> statement-breakpoint
ALTER TABLE "alert_job" ALTER COLUMN "source" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "alert_job" ALTER COLUMN "source" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."alert_job_source";--> statement-breakpoint
CREATE TYPE "public"."alert_job_source" AS ENUM('alert', 'favorite', 'similar');--> statement-breakpoint
ALTER TABLE "alert_job" ALTER COLUMN "source" SET DATA TYPE "public"."alert_job_source" USING "source"::"public"."alert_job_source";--> statement-breakpoint
ALTER TABLE "alert_job" ALTER COLUMN "source" SET DEFAULT 'alert';--> statement-breakpoint
CREATE UNIQUE INDEX "alert_job_alert_active_unique" ON "alert_job" USING btree ("user_id","student_alert_id","accommodation_id") WHERE "alert_job"."source" = 'alert' AND ("alert_job"."status" = 'pending' OR ("alert_job"."status" = 'failed' AND "alert_job"."attempts" < 3));--> statement-breakpoint
CREATE UNIQUE INDEX "alert_job_favorite_active_unique" ON "alert_job" USING btree ("user_id","accommodation_id") WHERE "alert_job"."source" = 'favorite' AND ("alert_job"."status" = 'pending' OR ("alert_job"."status" = 'failed' AND "alert_job"."attempts" < 3));--> statement-breakpoint
CREATE UNIQUE INDEX "alert_job_similar_active_unique" ON "alert_job" USING btree ("user_id","student_alert_id","accommodation_id") WHERE "alert_job"."source" = 'similar' AND ("alert_job"."status" = 'pending' OR ("alert_job"."status" = 'failed' AND "alert_job"."attempts" < 3));
