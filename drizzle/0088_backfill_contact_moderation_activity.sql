INSERT INTO "activity_log" ("created_at", "action", "entity_type", "entity_id", "entity_name", "owner_id", "owner_name", "metadata")
SELECT cr."reviewed_at", 'contact.status_updated', 'contact_request', cr."id"::text, a."name", o."id", o."name",
  jsonb_build_object('slug', a."slug", 'backfilled', true, 'diff', jsonb_build_object('contactStatus', jsonb_build_object('old', NULL, 'new', cr."status")))
FROM "contact_request" cr
INNER JOIN "accommodation" a ON a."id" = cr."accommodation_id"
LEFT JOIN "owner" o ON o."id" = a."owner_id"
WHERE cr."reviewed_at" IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM "activity_log" al
  WHERE al."action" = 'contact.status_updated' AND al."entity_type" = 'contact_request' AND al."entity_id" = cr."id"::text
);--> statement-breakpoint
INSERT INTO "activity_log" ("created_at", "action", "entity_type", "entity_id", "entity_name", "owner_id", "owner_name", "metadata")
SELECT dfa."reviewed_at", 'contact.status_updated', 'dossier_facile_application', dfa."id"::text, a."name", o."id", o."name",
  jsonb_build_object('slug', a."slug", 'backfilled', true, 'diff', jsonb_build_object('contactStatus', jsonb_build_object('old', NULL, 'new', dfa."status")))
FROM "dossier_facile_application" dfa
INNER JOIN "accommodation" a ON a."slug" = dfa."accommodation_slug"
LEFT JOIN "owner" o ON o."id" = a."owner_id"
WHERE dfa."reviewed_at" IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM "activity_log" al
  WHERE al."action" = 'contact.status_updated' AND al."entity_type" = 'dossier_facile_application' AND al."entity_id" = dfa."id"::text
);
