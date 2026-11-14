ALTER TABLE "alert_job" ADD COLUMN "send_id" uuid;--> statement-breakpoint
ALTER TABLE "alert_job" ADD COLUMN "failure_reported_at" timestamp with time zone;--> statement-breakpoint
UPDATE "alert_job" SET "failure_reported_at" = now() WHERE "status" = 'failed' AND "attempts" >= 3;--> statement-breakpoint
UPDATE "alert_job" SET "status" = 'pending', "error" = NULL WHERE "status" = 'failed' AND "attempts" < 3;
