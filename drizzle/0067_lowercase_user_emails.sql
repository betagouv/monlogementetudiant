-- Better Auth recherche les comptes en minuscules : une adresse stockée avec des majuscules (comptes
-- importés de Django, ou créés depuis l'administration avant normalisation) ne peut plus se connecter.
-- On passe ces adresses en minuscules, SAUF quand un autre compte existe déjà avec la même adresse à la
-- casse près : ces doublons demandent un arbitrage (fusion des favoris, alertes, candidatures) et restent
-- à traiter à part. La requête est idempotente.
UPDATE "user" AS u
SET email = lower(u.email), updated_at = now()
WHERE u.email <> lower(u.email)
  AND NOT EXISTS (
    SELECT 1 FROM "user" AS other
    WHERE other.id <> u.id AND lower(other.email) = lower(u.email)
  );
