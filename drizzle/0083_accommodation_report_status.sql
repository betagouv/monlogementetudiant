ALTER TABLE "accommodation_report" ADD COLUMN "status" "support_ticket_status" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "accommodation_report" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "accommodation_report_status_created_at_idx" ON "accommodation_report" USING btree ("status","created_at");