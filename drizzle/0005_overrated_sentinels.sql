CREATE INDEX "accommodation_owner_id_idx" ON "accommodation_accommodation" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "accommodation_published_idx" ON "accommodation_accommodation" USING btree ("published");--> statement-breakpoint
CREATE INDEX "user_owner_id_idx" ON "user" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "city_department_id_idx" ON "territories_city" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "department_academy_id_idx" ON "territories_department" USING btree ("academy_id");--> statement-breakpoint
CREATE INDEX "dossier_facile_tenant_user_id_idx" ON "dossier_facile_tenant" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "favorite_accommodation_user_id_idx" ON "accommodation_favoriteaccommodation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "student_alert_user_id_idx" ON "student_alert" USING btree ("user_id");