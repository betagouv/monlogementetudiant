-- Les FK heritees sont DEFERRABLE et drizzle-kit joue tout le lot dans une seule transaction :
-- sans cette ligne, les ALTER ci-dessous peuvent remonter un 55006.
SET CONSTRAINTS ALL IMMEDIATE;--> statement-breakpoint

-- 1. Absorption : qui gerait les disponibilites gere desormais les residences.
UPDATE "user" SET "bailleur_permissions" =
  array_append("bailleur_permissions", 'manage_residences'::bailleur_permission)
WHERE 'manage_availability' = ANY("bailleur_permissions")
  AND NOT ('manage_residences' = ANY("bailleur_permissions"));--> statement-breakpoint
-- 2. Pas de parcours de candidature choisi => pas d'acces aux donnees des candidats.
UPDATE "user" u SET "bailleur_permissions" =
  array_remove(u."bailleur_permissions", 'manage_applications'::bailleur_permission)
FROM "owner" o
WHERE u."owner_id" = o."id"
  AND u."bailleur_role" = 'gestionnaire'
  AND o."contact_mode" = 'none';--> statement-breakpoint
-- 3. Purge des deux valeurs retirees AVANT le changement de type : `ALTER COLUMN ... USING`
--    n'accepte pas de sous-requete, le filtrage ne peut donc pas se faire pendant la conversion.
UPDATE "user" SET "bailleur_permissions" =
  array_remove(array_remove("bailleur_permissions", 'manage_availability'::bailleur_permission), 'manage_users'::bailleur_permission)
WHERE 'manage_availability' = ANY("bailleur_permissions")
   OR 'manage_users' = ANY("bailleur_permissions");--> statement-breakpoint
-- 4. Recreation du type sans `manage_users` ni `manage_availability`. La conversion passe par
--    `text[]` : toutes les valeurs restantes existent dans le nouveau type grace a l'etape 3.
ALTER TYPE "public"."bailleur_permission" RENAME TO "bailleur_permission_old";--> statement-breakpoint
CREATE TYPE "public"."bailleur_permission" AS ENUM('manage_residences', 'manage_applications');--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "bailleur_permissions" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "bailleur_permissions" SET DATA TYPE "public"."bailleur_permission"[]
  USING "bailleur_permissions"::text[]::"public"."bailleur_permission"[];--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "bailleur_permissions" SET DEFAULT ARRAY[]::"public"."bailleur_permission"[];--> statement-breakpoint
DROP TYPE "public"."bailleur_permission_old";
