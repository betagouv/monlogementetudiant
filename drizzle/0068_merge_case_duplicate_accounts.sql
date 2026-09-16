-- Better Auth recherche les comptes en minuscules : une adresse stockée avec des majuscules (comptes
-- importés de Django, ou créés depuis l'administration avant normalisation) ne peut plus se connecter.
--
-- 1. Fusion des doublons à la casse près. Quand un ancien compte en majuscules a un jumeau en minuscules
--    (le compte réellement utilisé), et que les deux sont étudiants, on rapatrie les données de l'ancien
--    (favoris, alertes, simulations…) sur le récent, on complète son profil, puis on supprime l'ancien.
--    Les paires impliquant un bailleur ou un admin, et les groupes de plus de deux comptes, sont laissés
--    tels quels : ils demandent un arbitrage manuel.
-- 2. Passage en minuscules des adresses restantes sans doublon.
--
-- Tout est idempotent : un second passage ne trouve plus rien à fusionner ni à convertir.
CREATE TEMP TABLE account_case_merge ON COMMIT DROP AS
WITH pairs AS (
  -- Une seule passe sur la table : une sous-requête corrélée par compte prenait une minute en production.
  SELECT lower(email) AS normalized FROM "user" GROUP BY 1 HAVING count(*) = 2
)
SELECT source.id AS source_id, target.id AS target_id
FROM pairs
JOIN "user" AS target ON target.email = pairs.normalized
JOIN "user" AS source ON lower(source.email) = pairs.normalized AND source.id <> target.id
WHERE source.role = 'user' AND target.role = 'user';
--> statement-breakpoint
-- Favoris : ceux que le compte récent a déjà sont abandonnés, les autres rapatriés.
DELETE FROM favorite_accommodation AS f
USING account_case_merge AS m
WHERE f.user_id = m.source_id
  AND EXISTS (SELECT 1 FROM favorite_accommodation AS kept WHERE kept.user_id = m.target_id AND kept.accommodation_id = f.accommodation_id);
--> statement-breakpoint
UPDATE favorite_accommodation AS f SET user_id = m.target_id FROM account_case_merge AS m WHERE f.user_id = m.source_id;
--> statement-breakpoint
UPDATE student_alert AS a SET user_id = m.target_id FROM account_case_merge AS m WHERE a.user_id = m.source_id;
--> statement-breakpoint
-- Jobs d'alerte favori encore actifs en doublon avec ceux du compte récent (index uniques partiels).
DELETE FROM alert_job AS j
USING account_case_merge AS m
WHERE j.user_id = m.source_id
  AND j.source = 'favorite'
  AND (j.status = 'pending' OR (j.status = 'failed' AND j.attempts < 3))
  AND EXISTS (
    SELECT 1 FROM alert_job AS kept
    WHERE kept.user_id = m.target_id AND kept.source = 'favorite' AND kept.accommodation_id = j.accommodation_id
      AND (kept.status = 'pending' OR (kept.status = 'failed' AND kept.attempts < 3))
  );
--> statement-breakpoint
UPDATE alert_job AS j SET user_id = m.target_id FROM account_case_merge AS m WHERE j.user_id = m.source_id;
--> statement-breakpoint
-- Candidatures : une seule par (compte, résidence).
DELETE FROM contact_request AS c
USING account_case_merge AS m
WHERE c.user_id = m.source_id
  AND EXISTS (SELECT 1 FROM contact_request AS kept WHERE kept.user_id = m.target_id AND kept.accommodation_id = c.accommodation_id);
--> statement-breakpoint
UPDATE contact_request AS c SET user_id = m.target_id FROM account_case_merge AS m WHERE c.user_id = m.source_id;
--> statement-breakpoint
-- Données à un exemplaire par compte : rapatriées seulement si le compte récent n'en a pas.
UPDATE dossier_facile_tenant AS d SET user_id = m.target_id
FROM account_case_merge AS m
WHERE d.user_id = m.source_id AND NOT EXISTS (SELECT 1 FROM dossier_facile_tenant AS kept WHERE kept.user_id = m.target_id);
--> statement-breakpoint
UPDATE budget_simulation AS b SET user_id = m.target_id
FROM account_case_merge AS m
WHERE b.user_id = m.source_id AND NOT EXISTS (SELECT 1 FROM budget_simulation AS kept WHERE kept.user_id = m.target_id);
--> statement-breakpoint
UPDATE housing_aid_simulation AS h SET user_id = m.target_id
FROM account_case_merge AS m
WHERE h.user_id = m.source_id AND NOT EXISTS (SELECT 1 FROM housing_aid_simulation AS kept WHERE kept.user_id = m.target_id);
--> statement-breakpoint
-- Historique : rattaché au compte conservé plutôt que perdu.
UPDATE tracking_event AS t SET user_id = m.target_id FROM account_case_merge AS m WHERE t.user_id = m.source_id;
--> statement-breakpoint
UPDATE activity_log AS l SET user_id = m.target_id FROM account_case_merge AS m WHERE l.user_id = m.source_id;
--> statement-breakpoint
UPDATE login_attempt AS l SET user_id = m.target_id FROM account_case_merge AS m WHERE l.user_id = m.source_id;
--> statement-breakpoint
-- Profil : les champs vides du compte récent sont complétés par ceux de l'ancien.
UPDATE "user" AS t SET
  firstname = CASE WHEN t.firstname = '' THEN s.firstname ELSE t.firstname END,
  lastname = CASE WHEN t.lastname = '' THEN s.lastname ELSE t.lastname END,
  phone = coalesce(t.phone, s.phone),
  birthdate = coalesce(t.birthdate, s.birthdate),
  scholarship_status = coalesce(t.scholarship_status, s.scholarship_status),
  scholarship_type = coalesce(t.scholarship_type, s.scholarship_type),
  legacy_id = coalesce(t.legacy_id, s.legacy_id),
  updated_at = now()
FROM account_case_merge AS m
JOIN "user" AS s ON s.id = m.source_id
WHERE t.id = m.target_id;
--> statement-breakpoint
-- L'ancien compte part avec ce qui n'a pas été rapatrié (comptes de connexion, sessions, doublons).
DELETE FROM "user" AS u USING account_case_merge AS m WHERE u.id = m.source_id;
--> statement-breakpoint
UPDATE "user" AS u
SET email = lower(u.email), updated_at = now()
WHERE u.email <> lower(u.email)
  AND NOT EXISTS (
    SELECT 1 FROM "user" AS other
    WHERE other.id <> u.id AND lower(other.email) = lower(u.email)
  );
