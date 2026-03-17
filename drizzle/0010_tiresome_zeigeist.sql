CREATE TABLE "dossier_facile_document" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"owner_type" text NOT NULL,
	"document_category" text NOT NULL,
	"document_sub_category" text,
	"document_status" text,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dossier_facile_tenant" ADD COLUMN "guarantor_count" integer;--> statement-breakpoint
ALTER TABLE "dossier_facile_document" ADD CONSTRAINT "dossier_facile_document_tenant_id_dossier_facile_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."dossier_facile_tenant"("id") ON DELETE cascade ON UPDATE no action;