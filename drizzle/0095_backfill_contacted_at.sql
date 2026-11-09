UPDATE contact_request cr SET contacted_at = sub.at FROM (
  SELECT entity_id, min(created_at) AS at FROM activity_log
  WHERE action = 'contact.status_updated' AND entity_type = 'contact_request'
    AND metadata->'diff'->'contactStatus'->>'new' = 'contacte'
  GROUP BY entity_id) sub
WHERE cr.id::text = sub.entity_id AND cr.contacted_at IS NULL;--> statement-breakpoint
UPDATE contact_request SET contacted_at = coalesce(reviewed_at, updated_at) WHERE status = 'contacte' AND contacted_at IS NULL;--> statement-breakpoint
UPDATE dossier_facile_application cr SET contacted_at = sub.at FROM (
  SELECT entity_id, min(created_at) AS at FROM activity_log
  WHERE action = 'contact.status_updated' AND entity_type = 'dossier_facile_application'
    AND metadata->'diff'->'contactStatus'->>'new' = 'contacte'
  GROUP BY entity_id) sub
WHERE cr.id::text = sub.entity_id AND cr.contacted_at IS NULL;--> statement-breakpoint
UPDATE dossier_facile_application SET contacted_at = coalesce(reviewed_at, updated_at) WHERE status = 'contacte' AND contacted_at IS NULL;
