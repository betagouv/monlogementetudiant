-- Better Auth 1.7 : l'identité d'un compte passe de `accountId` seul au couple `(issuer, accountId)`.
--
-- `issuer` est un espace de noms synthétique construit par la lib : `local:<providerId>` pour les
-- méthodes locales, `local:oauth:<providerId>` pour un provider OAuth sans issuer propre. Ici seul
-- `credential` existe — `sign-up`, `password` et `update-user` sont les trois seuls chemins qui
-- écrivent dans `account`, et l'import Django (`cli/commands/migrate-users.ts`) fait de même ; le
-- plugin magic-link, lui, ne crée aucune ligne.
--
-- Pourquoi ce n'est pas un simple ADD COLUMN : `sign-in` filtre désormais sur
-- `account.issuer === createLocalAccountIssuer('credential')` (dist/api/routes/sign-in.mjs). Une
-- colonne absente ou laissée à NULL ne lève aucune erreur — elle fait juste échouer le `.find()`,
-- donc **tous les comptes existants perdent la connexion par mot de passe en silence**. Le backfill
-- fait partie de la migration, il n'est pas optionnel.
--
-- La génération drizzle produisait `ADD COLUMN "issuer" text NOT NULL` d'un bloc, ce qui échoue dès
-- qu'une ligne existe. On déroule donc en trois temps : colonne nullable, backfill, contrainte.

-- 1. Colonne d'abord nullable.
ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint

-- 2. Backfill. Voir `createLocalAccountIssuer` dans @better-auth/core/dist/db/schema/account.mjs :
--    la valeur est `'local:' || encodeURIComponent(providerId)`, soit `local:credential` ici.
UPDATE "account" SET "issuer" = 'local:credential' WHERE "provider_id" = 'credential';--> statement-breakpoint

-- 3. Garde-fou : si un `provider_id` inattendu est apparu depuis, on s'arrête avec un message
--    exploitable plutôt que de laisser le SET NOT NULL échouer sur un « contains null values »
--    qui ne dit pas quelles lignes sont en cause.
DO $$
DECLARE providers_sans_regle text;
BEGIN
  SELECT string_agg(DISTINCT "provider_id", ', ') INTO providers_sans_regle
  FROM "account" WHERE "issuer" IS NULL;

  IF providers_sans_regle IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 0057 : provider_id sans règle de backfill (%). Compléter le UPDATE ci-dessus avant de rejouer.', providers_sans_regle;
  END IF;
END $$;--> statement-breakpoint

-- 4. `drizzle-kit migrate` applique tout le lot dans une seule transaction. L'UPDATE ci-dessus y
--    laisse des événements de trigger en attente, et l'ALTER qui suit échoue alors en 55006
--    (« cannot ALTER TABLE because it has pending trigger events ») à cause des FK DEFERRABLE
--    héritées. Vider la file avant d'altérer la table.
SET CONSTRAINTS ALL IMMEDIATE;--> statement-breakpoint

ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint

-- 5. Index unique attendu par la lib. Un échec ici signale deux comptes partageant la même identité
--    `(issuer, account_id)` : Postgres nomme la clé en doublon, la résolution est manuelle.
CREATE UNIQUE INDEX "account_issuer_account_id_idx" ON "account" USING btree ("issuer","account_id");
