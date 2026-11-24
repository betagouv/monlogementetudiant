CREATE TABLE "api_key_owner" (
	"api_key_id" text PRIMARY KEY NOT NULL,
	"owner_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_key_owner" ADD CONSTRAINT "api_key_owner_api_key_id_apikey_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."apikey"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_owner" ADD CONSTRAINT "api_key_owner_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_key_owner_owner_id_idx" ON "api_key_owner" USING btree ("owner_id");