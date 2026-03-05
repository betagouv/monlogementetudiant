ALTER TABLE "accommodation_favoriteaccommodation" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "student_alert" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "accommodation_accommodation" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "accommodation_accommodation" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "newsletter_subscription" ALTER COLUMN "created_at" SET DEFAULT now();
