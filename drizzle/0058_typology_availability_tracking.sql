ALTER TABLE "accommodation_typology" ADD COLUMN "availability_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accommodation_typology" ADD COLUMN "availability_updated_by" text;--> statement-breakpoint
ALTER TABLE "accommodation_typology" ADD CONSTRAINT "accommodation_typology_availability_updated_by_user_id_fk" FOREIGN KEY ("availability_updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Reprise de l'historique déjà présent dans le journal d'activité.
--
-- Une mise à jour de disponibilités y laisse une clé de diff par typologie, sous deux conventions
-- qui coexistent : `typologies.<type>.nbAvailable` depuis le passage aux typologies (21/07/2026),
-- et les anciennes colonnes plates `nb<Typologie>Available` avant. Les deux sont reconnues ici, la
-- seconde par énumération explicite : `nbT1Available` et `nbT1BisAvailable` ne se distinguent pas
-- de façon fiable par un motif.
--
-- Le journal ne porte pas l'identifiant de la résidence, seulement son slug (`metadata->>'slug'`),
-- d'où la jointure par slug. L'auteur n'est repris que si son compte existe encore, la colonne
-- étant contrainte par une clé étrangère.
--
-- Seules les actions de gestionnaire sont reprises, et c'est automatique : les imports et les
-- scripts n'écrivent pas dans le journal d'activité.
WITH availability_events AS (
  SELECT
    al.metadata->>'slug' AS slug,
    al.created_at,
    al.user_id,
    CASE diff_key
      WHEN 'nbT1Available' THEN 't1'
      WHEN 'nbT1BisAvailable' THEN 't1_bis'
      WHEN 'nbT2Available' THEN 't2'
      WHEN 'nbT3Available' THEN 't3'
      WHEN 'nbT4Available' THEN 't4'
      WHEN 'nbT5Available' THEN 't5'
      WHEN 'nbT6Available' THEN 't6'
      WHEN 'nbT7MoreAvailable' THEN 't7_more'
      ELSE CASE
        WHEN diff_key ~ '^typologies\.[a-z0-9_]+\.nbAvailable$' THEN split_part(diff_key, '.', 2)
      END
    END AS typology_type
  FROM activity_log al
  CROSS JOIN LATERAL jsonb_object_keys(al.metadata->'diff') AS diff_key
  WHERE al.entity_type = 'accommodation'
    AND al.metadata->>'slug' IS NOT NULL
    AND jsonb_typeof(al.metadata->'diff') = 'object'
),
latest_per_typology AS (
  SELECT DISTINCT ON (slug, typology_type)
    slug,
    typology_type,
    created_at,
    user_id
  FROM availability_events
  WHERE typology_type IS NOT NULL
  ORDER BY slug, typology_type, created_at DESC
)
UPDATE accommodation_typology t
SET availability_updated_at = l.created_at,
    availability_updated_by = u.id
FROM latest_per_typology l
JOIN accommodation a ON a.slug = l.slug
LEFT JOIN "user" u ON u.id = l.user_id
WHERE t.accommodation_id = a.id
  AND t.type::text = l.typology_type
  -- Une typologie sans disponibilité ne porte pas de date : elle daterait une donnée absente.
  AND t.nb_available IS NOT NULL;
