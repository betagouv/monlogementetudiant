ALTER TABLE "budget_simulation" DROP CONSTRAINT "budget_simulation_user_id_unique";--> statement-breakpoint
ALTER TABLE "housing_aid_simulation" DROP CONSTRAINT "housing_aid_simulation_user_id_unique";--> statement-breakpoint
CREATE INDEX "budget_simulation_user_id_updated_at_idx" ON "budget_simulation" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "housing_aid_simulation_user_id_updated_at_idx" ON "housing_aid_simulation" USING btree ("user_id","updated_at");