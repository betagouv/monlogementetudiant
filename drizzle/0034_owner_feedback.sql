CREATE TYPE "public"."owner_feedback_status" AS ENUM('snoozed', 'submitted');--> statement-breakpoint
CREATE TABLE "owner_feedback" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" "owner_feedback_status" NOT NULL,
	"rating" integer,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owner_feedback_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "owner_feedback" ADD CONSTRAINT "owner_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;