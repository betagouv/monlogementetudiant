-- La migration 0045 a créé une typologie pour chaque colonne à plat non nulle, y compris les `0` que
-- l'ancien modèle stockait pour « aucun logement de ce type ». Ces `nb_total = 0` bloquent
-- l'enregistrement du formulaire (au moins 1 logement par typologie).
-- Typologie vide (aucune autre donnée) : supprimée. Typologie renseignée par ailleurs : total inconnu (NULL).

-- Agrégats recalculés sur l'état final, avec la sémantique de typologyAggregates()
-- (src/server/lib/typologies.ts). `nb_total_apartments` n'est remplacé que s'il valait 0 : certains
-- imports le renseignent depuis la source plutôt que par la somme des typologies.
UPDATE "accommodation" a SET
  "price_min" = sub.price_min,
  "price_max" = sub.price_max,
  "nb_total_apartments" = CASE WHEN a."nb_total_apartments" = 0 THEN sub.nb_total ELSE a."nb_total_apartments" END,
  "nb_available_apartments" = sub.nb_available
FROM (
  SELECT acc."id" AS accommodation_id,
    MIN(NULLIF(t."price_min", 0)) AS price_min,
    MAX(NULLIF(t."price_max", 0)) AS price_max,
    SUM(NULLIF(t."nb_total", 0)) AS nb_total,
    CASE WHEN bool_or(t."nb_available" IS NOT NULL) THEN SUM(t."nb_available") ELSE NULL END AS nb_available
  FROM "accommodation" acc
  LEFT JOIN "accommodation_typology" t ON t."accommodation_id" = acc."id"
    AND NOT (
      t."nb_total" = 0
      AND COALESCE(t."price_min", 0) = 0
      AND COALESCE(t."price_max", 0) = 0
      AND COALESCE(t."superficie_min", 0) = 0
      AND COALESCE(t."superficie_max", 0) = 0
      AND COALESCE(t."nb_available", 0) = 0
    )
  WHERE acc."id" IN (SELECT "accommodation_id" FROM "accommodation_typology" WHERE "nb_total" = 0)
  GROUP BY acc."id"
) sub
WHERE a."id" = sub.accommodation_id;
--> statement-breakpoint
DELETE FROM "accommodation_typology"
WHERE "nb_total" = 0
  AND COALESCE("price_min", 0) = 0
  AND COALESCE("price_max", 0) = 0
  AND COALESCE("superficie_min", 0) = 0
  AND COALESCE("superficie_max", 0) = 0
  AND COALESCE("nb_available", 0) = 0;
--> statement-breakpoint
UPDATE "accommodation_typology" SET "nb_total" = NULL WHERE "nb_total" = 0;
--> statement-breakpoint
-- Les FK héritées de Django sur "accommodation" sont DEFERRABLE INITIALLY DEFERRED : sans ce flush,
-- une migration suivante qui ALTER la table dans le même lot échouerait (55006).
SET CONSTRAINTS ALL IMMEDIATE;
