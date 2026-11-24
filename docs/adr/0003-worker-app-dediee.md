# ADR 0003 — Worker Graphile sur une app Scalingo dédiée

Statut : accepté · Domaine : infrastructure

## Contexte

Le worker Graphile (tâches planifiées, envoi des alertes, commandes CLI) a d'abord été conçu comme un second type de process de l'app web (`mle-prod`, `mle-staging`). L'équipe veut des logs distincts et des apps séparées : le worker et le site se redémarrent, se dimensionnent et se surveillent indépendamment.

Le CLI et le worker importent directement le code serveur de `src/` (base, services, tâches). Sur Scalingo, `PROJECT_DIR` n'embarque que le sous-dossier désigné : un package isolé ne verrait ni `src/` ni le lockfile racine.

## Décision

- **Deux apps par environnement** : `mle-prod` / `mle-worker`, `mle-staging` / `mle-worker-staging`. Les deux déploient tout le repo, même branche ; le `Procfile` déclare `web` et `worker`, le scaling choisit (`worker=0` sur le web, `web=0` sur le worker).
- **Monorepo léger** : `cli/` devient le package pnpm `apps/worker`, la racine reste l'app web. Le worker continue d'importer `src/` via l'alias `~/` et tourne avec `tsx`, sans build (`NPM_NO_BUILD=true` sur l'app worker).
- **Migrations au web seul** : la commande `postdeploy` migre sauf si `SKIP_POSTDEPLOY_MIGRATE=true` (app worker). Le worker, qui déploie plus vite, attend au démarrage que les migrations Drizzle du dépôt soient appliquées (15 min maximum).

Écartés : un monorepo complet (`apps/web`, `apps/worker`, `packages/core`), qui donnerait une vraie frontière de code mais déplacerait la moitié de `src/` et sortirait les imports `next/*` du code serveur ; et le worker comme process de l'app web, qui ne sépare ni les logs ni le cycle de vie.

## Conséquences

- Les variables d'env sont dupliquées : toute variable ajoutée au web doit l'être au worker, et la `DATABASE_URL` du worker (addon de l'app web) est à mettre à jour si ses identifiants changent.
- Chaque merge redéploie aussi le worker : les commandes en cours sont interrompues, il faut éviter de merger entre 01:00 et 08:00 UTC.
- La frontière entre code web et code worker reste conventionnelle ; extraire un package partagé reste possible, morceau par morceau.
