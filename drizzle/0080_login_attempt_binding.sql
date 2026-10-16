ALTER TABLE "login_attempt" ADD COLUMN "binding_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "login_attempt" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "login_attempt" ADD COLUMN "ip_hash" varchar(64);--> statement-breakpoint
CREATE INDEX "login_attempt_email_created_at_idx" ON "login_attempt" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "login_attempt_ip_hash_created_at_idx" ON "login_attempt" USING btree ("ip_hash","created_at");