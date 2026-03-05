ALTER TABLE "user" ADD COLUMN "owner_id" bigint;--> statement-breakpoint
UPDATE "user" SET "owner_id" = ao."id" FROM "account_owner" ao WHERE ao."user_id" = "user"."id";--> statement-breakpoint
ALTER TABLE "account_owner" DROP CONSTRAINT "account_owner_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "account_owner" DROP COLUMN "user_id";
