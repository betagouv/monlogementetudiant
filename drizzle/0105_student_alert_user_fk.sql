DELETE FROM "student_alert" sa WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = sa."user_id");--> statement-breakpoint
ALTER TABLE "student_alert" ADD CONSTRAINT "student_alert_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
