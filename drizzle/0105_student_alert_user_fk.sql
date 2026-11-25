-- La FK student_alert.user_id -> user.id était déclarée dans le schéma Drizzle (et son snapshot)
-- mais absente de 0000_initial.sql : les alertes d'un compte supprimé restaient orphelines.
-- On purge les orphelines avant de poser la contrainte avec le cascade attendu.
DELETE FROM "student_alert" sa WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = sa."user_id");--> statement-breakpoint
ALTER TABLE "student_alert" ADD CONSTRAINT "student_alert_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
