CREATE TABLE "dossier_facile_application" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"accommodation_slug" varchar(255) NOT NULL,
	"apartment_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dossier_facile_application_tenant_id_accommodation_slug_unique" UNIQUE("tenant_id","accommodation_slug")
);
--> statement-breakpoint
ALTER TABLE "dossier_facile_application" ADD CONSTRAINT "dossier_facile_application_tenant_id_dossier_facile_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dossier_facile_tenant"("id") ON DELETE cascade ON UPDATE no action;