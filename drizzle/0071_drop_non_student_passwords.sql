-- Les bailleurs et les administrateurs se connectent uniquement par lien : leurs pages de connexion
-- n'exposent aucun champ mot de passe, `sendResetPassword` refuse les rôles autres que `user`, et
-- `/verify-password` est désactivée. Les hachages qu'ils portent encore sont des vestiges de la
-- bascule Django de mars 2026 — ils n'ouvrent aucune session et n'ont pas à être conservés.
--
-- `0070` n'a traité que les lignes à `account_id` hérité ; celles créées depuis l'application y ont
-- échappé. La suppression de la ligne `account` ne coupe pas le lien de connexion : Better Auth
-- n'exige une ligne `credential` que pour `sign-in/email`.
--
-- Idempotent : un second passage ne trouve plus rien à supprimer.
DELETE FROM "account" AS a
USING "user" AS u
WHERE a.user_id = u.id
  AND a.provider_id = 'credential'
  AND u.role <> 'user';
