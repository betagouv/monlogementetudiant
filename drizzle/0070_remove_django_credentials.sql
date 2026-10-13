DELETE FROM "account" AS a
USING "user" AS u
WHERE a.user_id = u.id
  AND a.provider_id = 'credential'
  AND a.account_id <> a.user_id
  AND (
    u.role <> 'user'
    OR a.password IS NULL
    OR a.password LIKE 'pbkdf2_sha256$%'
    OR EXISTS (
      SELECT 1 FROM "account" AS current
      WHERE current.user_id = a.user_id AND current.provider_id = 'credential' AND current.account_id = a.user_id
    )
  );
--> statement-breakpoint
UPDATE "account"
SET account_id = user_id, updated_at = now()
WHERE provider_id = 'credential' AND account_id <> user_id;
