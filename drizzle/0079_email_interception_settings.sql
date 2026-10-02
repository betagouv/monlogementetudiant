CREATE TABLE "email_interception_settings" (
	"id" text PRIMARY KEY DEFAULT 'SINGLETON' NOT NULL,
	"redirect_email" text,
	"bypass_redirect" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "email_interception_settings" ADD CONSTRAINT "email_interception_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;