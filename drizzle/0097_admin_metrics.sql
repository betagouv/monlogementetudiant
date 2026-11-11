CREATE TABLE "application_fact" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"channel" varchar(20) NOT NULL,
	"owner_id" bigint,
	"accommodation_id" bigint,
	"city_id" bigint,
	"created_at" timestamp with time zone NOT NULL,
	"scholarship_status" "scholarship_status",
	"status" text NOT NULL,
	"first_treated_at" timestamp with time zone,
	"contacted_at" timestamp with time zone,
	"attributed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_metric" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "monthly_metric_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"month" varchar(7) NOT NULL,
	"metric" varchar(64) NOT NULL,
	"scope" varchar(10) NOT NULL,
	"scope_id" bigint DEFAULT 0 NOT NULL,
	"value" integer NOT NULL,
	"boursiers" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_metric_month_metric_scope_scope_id_unique" UNIQUE("month","metric","scope","scope_id")
);
--> statement-breakpoint
CREATE INDEX "application_fact_created_at_idx" ON "application_fact" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "application_fact_owner_created_at_idx" ON "application_fact" USING btree ("owner_id","created_at");