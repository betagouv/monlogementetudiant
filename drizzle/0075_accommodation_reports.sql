CREATE TABLE "accommodation_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accommodation_id" bigint NOT NULL,
	"field" text NOT NULL,
	"details" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accommodation_report" ADD CONSTRAINT "accommodation_report_accommodation_id_accommodation_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accommodation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accommodation_report_ip_hash_created_at_idx" ON "accommodation_report" USING btree ("ip_hash","created_at");