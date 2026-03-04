-- 1. Legacy user flag
ALTER TABLE "user" ADD COLUMN "legacy_user" boolean NOT NULL DEFAULT false;
UPDATE "user" SET "legacy_user" = true
  WHERE id IN (SELECT user_id FROM account WHERE password LIKE 'pbkdf2_sha256$%');

-- 2. Drop django_content_type
DROP TABLE IF EXISTS "django_content_type";

-- 3. Rename + clean Q&A table (only if it exists — prod only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faq_questionanswer') THEN
    DELETE FROM "faq_questionanswer" WHERE content_type_id IS NOT NULL;
    ALTER TABLE "faq_questionanswer" DROP COLUMN IF EXISTS "content_type_id";
    ALTER TABLE "faq_questionanswer" DROP COLUMN IF EXISTS "object_id";
    ALTER TABLE "faq_questionanswer" RENAME TO "faq_question_answer";
  END IF;
END $$;
