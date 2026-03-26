CREATE TABLE "dossier_facile_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"owner_type" text NOT NULL,
	"document_category" text NOT NULL,
	"document_sub_category" text,
	"document_status" text,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dossier_facile_document_tenant_id_owner_type_document_category_document_sub_category_unique" UNIQUE("tenant_id","owner_type","document_category","document_sub_category")
);
--> statement-breakpoint
ALTER TABLE "dossier_facile_application" DROP CONSTRAINT "dossier_facile_application_tenant_id_dossier_facile_tenant_id_fk";--> statement-breakpoint
ALTER TABLE "dossier_facile_tenant" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "dossier_facile_tenant" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();--> statement-breakpoint
ALTER TABLE "dossier_facile_tenant" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "dossier_facile_application" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "dossier_facile_application" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();--> statement-breakpoint
ALTER TABLE "dossier_facile_application" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "dossier_facile_application" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "dossier_facile_application" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING gen_random_uuid();--> statement-breakpoint
ALTER TABLE "dossier_facile_application" ADD CONSTRAINT "dossier_facile_application_tenant_id_dossier_facile_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dossier_facile_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier_facile_application" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "dossier_facile_application" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossier_facile_tenant" ADD COLUMN "guarantor_count" integer;--> statement-breakpoint
ALTER TABLE "dossier_facile_document" ADD CONSTRAINT "dossier_facile_document_tenant_id_dossier_facile_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dossier_facile_tenant"("id") ON DELETE cascade ON UPDATE no action;