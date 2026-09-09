# Mon Logement Étudiant - Client

Plateforme qui aide les étudiants à trouver un logement.

## Stack

- Next.js (App Router)
- React 19
- React-DSFR
- React Query (TanStack)
- tRPC + Drizzle ORM
- nuqs (URL state)
- React Hook Form + Zod
- Leaflet
- tss-react
- Biome

## Installation

```bash
pnpm install
```

## Base de données

PostGIS local via Docker Compose (dev sur port 5433, test sur port 5434) :

```bash
docker compose up -d
```

Appliquer les migrations :

```bash
pnpm drizzle-kit migrate
```

Les variables de connexion sont dans `.env.dist` :

```
DATABASE_URL=postgres://mle:mle@localhost:5490/mle_dev
DATABASE_URL_TEST=postgres://test:test@localhost:5491/mle_test

cp .env.dist .env
```

## Commandes

```bash
pnpm dev        # Dev local
pnpm build      # Build production
pnpm start      # Start production
pnpm lint       # Lint (Biome)
```

## CLI

Outil CLI pour les opérations de maintenance, imports et synchronisations.

```bash
pnpm cli <command> [options]
```

Le CLI charge automatiquement le `.env` via `tsx --env-file=.env`. Toutes les commandes supportent `--dry-run` (simulation sans écriture en BDD) et `--verbose` (affichage détaillé).

### Architecture

Le CLI utilise un pattern **factory avec registre lazy** : les commandes sont chargées dynamiquement via `import()` au moment de l'exécution. Chaque commande exporte un objet `default` qui implémente `ImportCommand` ou `SyncCommand` (définis dans `cli/types.ts`).

```
cli/
  index.ts              # Point d'entrée (commander)
  types.ts              # Interfaces ImportCommand, SyncCommand
  factory.ts            # Registre lazy + runner (runImport, runSync)
  lib/
    db.ts               # Connexion Drizzle CLI avec closeDb()
    db-utils.ts          # clean/restore DB
    scalingo-backup.ts   # API Scalingo
    backup-storage.ts    # Dépôt et rétention des backups dans S3
    geocoder.ts          # Géocodage BAN + geo.api.gouv.fr
    matomo.ts            # Service API Matomo
  commands/
    migrate-users.ts     # Migration users Django
    demote-bailleur-admins.ts # Aligne les rôles bailleurs sur un CSV (rétrogradations + promotions)
    backfill-brevo-contacts.ts # Rattrapage des contacts Brevo (étudiants + gestionnaires)
    backfill-geocoding.ts # Recalage des geom aberrantes et des city_id mal résolus
    import-backup.ts     # Import backup Scalingo
    backup-db.ts         # Externalisation du backup Scalingo vers S3 (cron prod)
    import-arpej-ibail.ts # Import résidences ARPEJ (API iBAIL)
    import-crous.ts       # Import résidences CROUS depuis XLSX
    import-crous-rents.ts # Import loyers min/max CROUS par typologie depuis XLSX
    import-crous-surfaces.ts # Import superficies min/max CROUS par typologie depuis XLSX
    import-csv.ts        # Import générique depuis CSV
    import-fac-habitat.ts # Import résidences FAC HABITAT (SFTP)
    upload-images.ts     # Upload images locales vers S3
    storage/
      types.ts             # Types partagés (BrokenUrl, UnreferencedFile, AuditResult)
      findStorageIssues.ts # Détection : listing S3 + cross-ref DB + HEAD HTTP
      fixStorageIssues.ts  # Correction : update DB + suppression S3
      auditStorage.ts      # Entry point (résumé console + CSV optionnel)
    sync-cities.ts       # Sync villes (geo.api.gouv.fr) + rattrapage toutes communes
    sync-rents.ts        # Sync loyers moyens (data.gouv.fr)
    sync-students.ts     # Sync nb étudiants (enseignementsup)
    sync-stats.ts        # Sync stats Matomo
    seed-alert-snapshot.ts  # Amorce la baseline du snapshot de dispo (silencieux)
    backfill-alert-jobs.ts  # Vague initiale : jobs pour le stock dispo × alertes existantes
    detect-alert-jobs.ts    # Détecte les hausses de dispo et crée les jobs (réconciliation)
    send-alert-jobs.ts      # Draine la file de jobs et envoie les emails d'alerte
    expire-alerts.ts        # Relance à 3 mois puis désactive les alertes sans réaction
```

---

### Commandes standalone

#### `demote-bailleur-admins` — Aligner les rôles bailleurs sur un CSV

```bash
pnpm cli demote-bailleur-admins --file ~/comptes.csv                        # dry-run (défaut)
pnpm cli demote-bailleur-admins --file ~/comptes.csv --verbose              # dry-run détaillé
pnpm cli demote-bailleur-admins --file ~/comptes.csv --apply                # écriture
pnpm cli demote-bailleur-admins --file ~/comptes.csv --apply --no-promote   # rétrogradations seules
```

Le CSV attend au minimum les colonnes `email` et `admin` (le fichier de référence a
`prenom,nom,email,nom_gestionnaire,admin`).

- **`admin` vide** → le compte passe en `gestionnaire` avec les permissions « Dossiers étudiants »,
  « Disponibilités des résidences » et « Gestion des résidences » — volontairement sans
  « Gestion des utilisateurs ».
- **`admin` = `oui`** → le compte devient administrateur s'il ne l'est pas déjà (permissions remises à
  `[]`, conformément à l'invariant du routeur). `--no-promote` désactive ce volet : la commande se
  contente alors de signaler les comptes attendus administrateurs qui ne le sont pas en base.

Le rapport de rapprochement est imprimé **avant** toute écriture et avant un éventuel abandon : on voit
donc toujours pourquoi un run s'arrête. Les administrateurs attendus mais absents de la base sont
signalés à part — c'est le symptôme d'un CSV et d'une base qui ne décrivent pas le même état.

Le fichier n'est **pas** versionné : il contient des emails nominatifs, d'où un script paramétré plutôt
qu'une migration SQL. La commande est idempotente (un compte déjà conforme est ignoré), dédoublonne les
emails, rapproche par email insensible à la casse, et signale les emails absents de la base.

Filet de sécurité : avant toute écriture, la commande projette l'état final de chaque bailleur
(administrateurs actuels − rétrogradés + promus) et abandonne en listant les bailleurs fautifs si l'un
d'eux tomberait à **zéro** administrateur (`--allow-no-admin` force le passage) ou dépasserait
**2** administrateurs alors qu'on y promeut quelqu'un. Une rétrogradation seule ne bute jamais sur le
plafond : elle ne peut qu'améliorer un bailleur historiquement au-dessus de la limite.

Sur Scalingo, le CSV doit être envoyé dans le conteneur one-off (`scalingo run --file` le dépose dans
`/tmp/uploads/`) :

```bash
scalingo --app mle-prod --region osc-secnum-fr1 run --file ~/comptes.csv \
  pnpm cli demote-bailleur-admins --file /tmp/uploads/comptes.csv --apply
```

#### `migrate-users` — Migrer les users Django vers better-auth

```bash
pnpm cli migrate-users
```

Lit les tables Django existantes dans la BDD locale (typiquement après un `import-backup`) et traduit les utilisateurs vers le schéma better-auth : insertion dans les tables `user` et `account`, puis liaison des owners existants par correspondance de nom, et liaisons des utilisateurs students.

À utiliser une seule fois après la migration Django → tRPC/Drizzle.

#### `backfill-cache-control` — Rattraper le Cache-Control des médias S3

```bash
pnpm cli backfill-cache-control --dry-run --verbose   # lister ce qui serait corrigé
pnpm cli backfill-cache-control                        # rattrapage complet
pnpm cli backfill-cache-control --prefix purges/       # un autre préfixe
```

`uploadFile` pose `public, max-age=15552000, immutable` sur les objets déposés (les clés étant
des UUID, une photo remplacée reçoit une nouvelle clé : le contenu d'une clé ne change jamais).
Les médias antérieurs n'ont aucun en-tête de cache — les navigateurs revalident, et `next/image`
plafonne le TTL de ses dérivées à `minimumCacheTTL`, soit 4 h, au lieu de reprendre le `max-age`
amont.

S3 ne sait pas muter un en-tête en place : la commande recopie chaque objet sur lui-même avec
`MetadataDirective: REPLACE`. Elle est idempotente et reprenable — un objet déjà à jour est
ignoré — et sort en code 1 si au moins un objet a échoué, pour que le one-off Scalingo le
signale.

À lancer une fois par bucket, en one-off :

```bash
scalingo --app mle-prod --region osc-secnum-fr1 run pnpm cli backfill-cache-control --verbose
```

##### Cache des images optimisées

`next/image` écrit ses dérivées dans `.next/cache/images`, sur le disque **éphémère** du
container : avec 4 containers web, une même vignette est réencodée par sharp jusqu'à 4 fois, et
tout repart à zéro à chaque deploy. `cache-handler.mjs` (racine du repo, branché via
`cacheHandler` + `images.customCacheHandler` dans `next.config.mjs`) remplace ce cache local par
un cache à deux étages : un LRU en mémoire par container (`IMAGE_CACHE_MEMORY_MB`, 128 Mo par
défaut) devant le bucket S3, partagé par les containers et conservé entre les deploys.

Les dérivées vivent sous le préfixe `image-cache/`, sans ACL publique. Comme les
archives de `purge-logs`, elles ne sont référencées par aucune ligne en base : `audit-storage`
les exclut explicitement de son balayage des orphelins.

Seules les entrées `IMAGE` sont détournées ; le reste du cache incrémental (fetch cache des
services WordPress / RAMSESE, pages prérendues) est délégué au `FileSystemCache` de Next. Ce
dernier est importé par un chemin interne à Next, non couvert par son semver public : **à
revérifier à chaque montée de version majeure** — le handler échoue au boot plutôt que de
dégrader le cache en silence.

#### `purge-logs` — Purger les tables append-only

```bash
pnpm cli purge-logs --dry-run --verbose        # simulation, détail par table
pnpm cli purge-logs                             # purge + archivage S3
pnpm cli purge-logs --table tracking_event      # une seule table
pnpm cli purge-logs --retention-months 12       # force la rétention de toutes les tables
```

Supprime les lignes plus vieilles que la rétention (filtre sur `created_at`) dans les tables qui ne
sont jamais mises à jour et grossissent donc indéfiniment (ex. aout 2026):

| Table | Rétention | Taille | Croissance | Périmètre |
|-------|-----------|--------|------------|-----------|
| `tracking_event` | **7 mois** | 805 Mo | ~385 Mo/mois | tous les événements de navigation |
| `alert_job` | 12 mois | 11 Mo | ~8,8 Mo/mois | **jobs terminés uniquement** (`sent`, `failed`) ; les `pending` restent actionnables par le sender |
| `activity_log` | 36 mois | 5 Mo | ~0,5 Mo/mois, en décroissance | journal d'actions admin/bailleurs |
| `import_job` | 24 mois | 1,9 Mo | ~0,2 Mo/mois | audit trail des imports et des crons |

Les rétentions sont volontairement dissymétriques. `tracking_event` pèse 98 % du total et croît
40 fois plus vite que la somme des trois autres : c'est la seule dont la rétention se paie en
gigaoctets, donc la seule à purger court. Sur les autres, allonger la rétention coûte quelques
dizaines de mégaoctets sur plusieurs années — moins cher qu'un écran d'admin qui affiche un trou :

- **`activity_log`** — l'écran « Statistiques gestionnaires » laisse choisir une **plage de dates
  libre** (deux champs `type="date"`, au-delà des présélections 7/30/90 jours). Purger court ferait
  silencieusement retourner zéro sur les plages anciennes, pour économiser 5 Mo sur une table qui
  décroît. La rétention n'est ici qu'un garde-fou.
- **`import_job`** — l'admin « Tâches planifiées » affiche le dernier run de **chaque type de
  cron** (`selectDistinctOn`). Certains sont trimestriels (`sync rents`) : une rétention courte
  pourrait effacer le seul enregistrement d'un job rare et l'afficher comme jamais exécuté.
- **`alert_job`** — n'est relu par aucun écran ni aucune API. `onConflictDoNothing` du détecteur
  s'appuie sur les index uniques partiels, qui ne couvrent que `pending` / `failed` : un job `sent`
  ne bloque aucune réémission. Les 12 mois ne servent qu'au diagnostic a posteriori.

La rétention de `tracking_event` est dictée par le tableau de bord bailleur
(`owner-statistics.ts`). Le sélecteur n'expose que `7d` / `30d` / `90d`, donc **90 jours sont
affichés** — mais une requête remonte à **180 jours** : `countConsultOffer` sur la période
précédente, qui alimente le badge d'évolution des consultations d'offre en période `90d`. Sept mois
couvrent cette fenêtre avec ~33 jours de marge.

Attention si quelqu'un rallonge un jour les périodes proposées dans le tableau de bord : la
rétention doit suivre, sinon les écrans afficheront des chiffres faux sans lever d'erreur.

`stats` et `event_stat` sont volontairement exclues : ce sont déjà des agrégats journaliers, dont
le volume est négligeable.

**Archivage.** Avant chaque suppression, les lignes condamnées sont déposées dans S3 en **NDJSON
gzippé** (une ligne = un objet JSON), sous
`purges<suffixe-env>/<table>/<année>/<mois>/<table>-<horodatage>.ndjson.gz`. Ce format est écrit en
flux (mémoire bornée quel que soit le volume), reste exploitable même tronqué, préserve les `jsonb`
et les `null`, et se relit sans outillage :

```bash
# Inspecter une archive
aws s3 cp s3://<bucket>/purges/tracking_event/2026/08/....ndjson.gz - | zcat | jq .

# Réinjecter une archive en base (procédure vérifiée sur une archive réelle)
psql "$DATABASE_URL" -c "create table _restore(row jsonb)"

# Le quote/delimiter exotiques sont indispensables : en `copy ... from stdin` texte, PostgreSQL
# interpréterait les antislashs du JSON et corromprait silencieusement les données.
zcat archive.ndjson.gz | psql "$DATABASE_URL" \
  -c "copy _restore(row) from stdin csv quote e'\x01' delimiter e'\x02'"

psql "$DATABASE_URL" \
  -c "insert into tracking_event select (jsonb_populate_record(null::tracking_event, row)).* from _restore" \
  -c "drop table _restore"
```

Les identifiants d'origine sont réinjectés tels quels. Sans conséquence dans le cas courant (ils
sont inférieurs au maximum en base), mais si la table a été vidée entre-temps il faut repositionner
la séquence : `select setval(pg_get_serial_sequence('tracking_event','id'), max(id)) from
tracking_event;`

Procédure vérifiée de bout en bout sur une archive réelle de 808 573 lignes (22 Mo compressés,
20 s de rechargement).

Si le dépôt S3 échoue, **rien n'est supprimé** : mieux vaut une table qui grossit un jour de plus
que des lignes perdues sans filet.

Options :

| Option | Description |
|--------|-------------|
| `--dry-run` | Compte les lignes sans rien supprimer ni archiver |
| `--verbose` | Affiche le filtre, la coupure et la clé d'archive par table |
| `--retention-months <n>` | Force la rétention de **toutes** les tables |
| `--max-rows <n>` | Plafond de lignes par table et par run (défaut : 2 000 000) |
| `--table <name>` | Ne traite qu'une table |
| `--no-archive` | Supprime sans déposer d'archive |

**Cadence : mensuelle**, le 1er de chaque mois à 5h. Une archive par table et par mois,
d'environ 30 Mo compressés pour `tracking_event`. C'est la rétention, et non la cadence, qui fixe la
taille de la table : une purge plus rare la fait grossir, puisque les lignes expirées y attendent
plus longtemps. Une ligne de `tracking_event` vit donc entre 7 et 8 mois.

Le plafond `--max-rows` est dimensionné au-dessus d'un mois d'événements (~1,2 M lignes) : il ne
mord que sur le premier passage, qui rattrape l'historique. La commande signale explicitement les
tables tronquées et il suffit de la relancer. Idempotente, visible dans l'admin
« Tâches planifiées ».

> **Espace disque.** La suppression de lignes ne rend pas le disque au système : PostgreSQL garde
> les pages libérées pour ses propres écritures. Après une grosse purge de rattrapage, il faut un
> `VACUUM FULL` (lock exclusif) ou `pg_repack` pour que la base rétrécisse réellement. C'est la
> limite de l'approche par `DELETE`, et l'argument principal en faveur d'un partitionnement mensuel
> de `tracking_event` si le volume le justifie un jour : la purge deviendrait un `DROP PARTITION`
> instantané qui libère le disque immédiatement.

Variables d'env requises : `DATABASE_URL`, `S3_*` (sauf avec `--no-archive`)

#### `backfill-brevo-contacts` — Rattraper les contacts Brevo

```bash
pnpm cli backfill-brevo-contacts --dry-run --limit 20 --verbose   # simulation sur un échantillon
pnpm cli backfill-brevo-contacts --verbose                        # run complet
```

Parcourt toute la base et synchronise les attributs Brevo (`COMPTE_ESPACE_GESTIONNAIRE`, `DATE_CREATION_COMPTE_ESPACE_GESTIONNAIRE`, `NOM`, `PRENOM`) pour chaque utilisateur :

- **Gestionnaires** (`role = 'owner'`) : `COMPTE_ESPACE_GESTIONNAIRE = true`, date = `user.created_at`.
- **Étudiants** (`role = 'user'`) : `COMPTE_ESPACE_GESTIONNAIRE = false`, date vidée (chaîne vide).
- **Admins** (`role = 'admin'`) : exclus du rattrapage.

Les requêtes Brevo sont envoyées par lots (concurrence limitée + délai entre lots) pour respecter le rate limit de l'API contacts. Un échec sur un contact n'interrompt pas le run : le détail des erreurs est affiché en fin d'exécution.

Options :

| Option | Description |
|--------|-------------|
| `--dry-run` | Simule sans appeler Brevo |
| `--verbose` | Affiche chaque contact traité |
| `--limit <n>` | Limite le nombre d'utilisateurs traités |
| `--batch-size <n>` | Nombre de requêtes Brevo en parallèle par lot (défaut : 5) |

Variables d'env requises : `DATABASE_URL`, `BREVO_API_KEY`, `BREVO_CONTACTS_API_URL`

> Conçue pour un one-off Scalingo. Sur Scalingo (vars injectées, pas de fichier `.env`), lancer directement `tsx cli/index.ts backfill-brevo-contacts --verbose` plutôt que `pnpm cli` (qui charge `--env-file=.env`).

#### `backfill-geocoding` — Recaler les adresses mal géocodées

```bash
pnpm cli backfill-geocoding                                  # rapport : liste ce qui demande une revue manuelle
pnpm cli backfill-geocoding --phase city --csv /tmp/city.csv # simulation du recalage des city_id
pnpm cli backfill-geocoding --phase city --apply             # écriture
pnpm cli backfill-geocoding --phase geom --apply --verbose   # écriture des coordonnées
```

> ⚠️ Contrairement aux autres commandes, celle-ci est **en dry-run par défaut** : c'est `--apply` qui déclenche l'écriture, pas l'absence de `--dry-run`.

Rattrape deux défauts distincts hérités des imports, chacun sur son propre périmètre.

Les deux phases d'écriture ne travaillent que sur les adresses **déjà incohérentes** — celles dont le point tombe hors de la commune de leur `city_id`. Une adresse saine n'est jamais lue, jamais réécrite.

**Phase `city`** — recale le `city_id` sur la commune où le point se trouve, sans toucher aux coordonnées, et seulement quand une source indépendante confirme ce point : soit la BAN y place l'adresse, soit elle la place dans le même département (cas des codes CEDEX), soit le point est dans une commune du code postal. Répare les rattachements arbitraires d'avant le correctif (Rezé pour Nantes, Faugères pour Montpellier, Saint-Denis de La Réunion pour la Seine-Saint-Denis).

**Phase `geom`** — corrige le point pour les adresses que `city` n'a pas pu résoudre, signe que ce sont les coordonnées qui sont en cause. Écrit `geom` et `city_id` ensemble, pour ne pas laisser la ville affichée en désaccord avec la position.

**Phase `report`** (défaut) — n'écrit rien, liste les adresses à arbitrer à la main.

Chaque adresse reçoit une décision :

| Décision | Sens |
|----------|------|
| `apply` | Candidat rattachable à la commune du code postal, ou repli sur son centre |
| `keep` | Le point en base est déjà plausible, on n'y touche pas |
| `flag` | Indécidable automatiquement — revue manuelle |

Les `flag` sont pour l'essentiel des adresses dont le numéro de boîte a été rangé dans le code postal à l'import (`2 rue du Général Delestraint CS` + code postal `15250`) : l'information d'origine est perdue, seule une correction manuelle est possible. Le motif `boundary-disagreement` en signale un second type : la commune que la BAN attribue à l'adresse ne contient pas le point retenu d'après `city.boundary` — cas des adresses en limite de deux communes, où les deux sources ne s'accordent pas.

Après un cycle complet, `report` ne doit plus afficher que des `MANUELLE` : tout ce qui est annoncé `CORRIGEABLE` est effectivement corrigé, et relancer les phases ne modifie plus rien.

> **Ordre d'exécution : `city` avant `geom`.** Tant que le `city_id` est faux, le nom de commune qui en dérive pollue la requête envoyée à la BAN et fausse la validation des candidats. `city` résolvant déjà une partie du lot, `geom` en voit d'autant moins.

Vérifié sur une copie locale d'un backup de production (1571 adresses, 98 incohérentes) : **85 réparées, 0 adresse saine dégradée**, 13 restantes renvoyées en revue manuelle. Requête de contrôle :

```sql
SELECT count(*) FROM accommodation_address aa JOIN city c ON c.id = aa.city_id
WHERE aa.geom IS NOT NULL AND c.boundary IS NOT NULL AND NOT ST_Within(aa.geom, c.boundary);
```

Options :

| Option | Description |
|--------|-------------|
| `--phase <phase>` | `report` (défaut), `geom` ou `city` |
| `--apply` | Écrit en base (par défaut : simulation) |
| `--verbose` | Affiche chaque ligne traitée |
| `--limit <n>` | Limite le nombre d'adresses examinées |
| `--csv <path>` | Écrit le rapport détaillé (décision, confiance, motif, coordonnées) |

Avec `--apply`, un fichier `rollback-geocoding-<phase>.sql` est écrit : il contient le `SELECT` des valeurs à capturer avant l'opération pour un retour arrière.

Variables d'env requises : `DATABASE_URL`, `GEOCODING_API_URL` (défaut : `https://data.geopf.fr/geocodage/search`)

#### `import-backup` — Importer un backup Scalingo

```bash
pnpm cli import-backup
pnpm cli import-backup --backup-path /chemin/vers/backup.tar.gz
pnpm cli import-backup --skip-download
```

Télécharge le dernier backup Scalingo, restore dans la DB locale et applique les migrations Drizzle.

Options :
- `--backup-path <path>` : utiliser un fichier backup local au lieu de télécharger
- `--skip-download` : réutiliser un backup déjà téléchargé dans `/tmp/jde-backup/`

Variables d'env requises : `SCALINGO_API_TOKEN`, `SCALINGO_APP`

#### `backup-db` — Externaliser le backup de la base vers S3

```bash
pnpm cli backup-db --dry-run --verbose   # en local : montre le backup retenu et la clé calculée
```

Copie le dernier backup PostgreSQL produit par Scalingo dans le bucket `S3_BACKUP_BUCKET`. Piloté par
un cron quotidien à 5h00 UTC, **en production uniquement** (`cron.json` est commun à toutes les apps
déployées depuis ce repo : la garde est dans le code, pas dans le planificateur).

On ne produit pas le dump nous-mêmes : `pg_dump` n'existe pas dans un conteneur Node Scalingo, et
l'addon PostgreSQL fabrique déjà un backup cohérent chaque nuit vers 00h01 UTC. La commande se
contente de l'externaliser, en streaming (l'archive pèse ~300 Mo, elle ne transite pas par le disque
ni par un `Buffer`).

**Rétention — le tri se fait à l'écriture, pas à la suppression :**

```
monlogementetudiant-db-backups/
  monthly/{app_name}-2026-08-01.tar.gz   ← le 1er du mois, conservé indéfiniment
  monthly/{app_name}-2026-08-15.tar.gz   ← le 15 du mois, conservé indéfiniment
  daily/{app_name}-2026-08-18.tar.gz     ← tous les autres jours, supprimé à J+31
```

La purge ne liste que le préfixe `daily/` : les backups conservés vivent sous `monthly/`,
physiquement hors de sa portée. Aucune condition n'est écrite pour les épargner, donc aucune
condition ne peut se tromper. Une clé hors format est ignorée, jamais supprimée.

Ce n'est **pas** un lifecycle S3 : une règle de lifecycle raisonne en âge d'objet (en jours) et non
en calendrier, elle ne sait pas exclure « le 1er et le 15 » ; et un `PutBucketLifecycleConfiguration`
remplace la configuration complète du bucket, écrasant silencieusement toute autre règle. La purge
en TypeScript est versionnée, testable (`cli/lib/__tests__/backup-storage.test.ts`) et visible en
`--dry-run`.

Garde-fous : la commande refuse un backup Scalingo de plus de 36 h (mieux vaut un cron en échec, qui
envoie un mail, qu'un doublon déposé silencieusement sous la date du jour), vérifie la taille de
l'objet déposé avant de purger quoi que ce soit, et ne supprime aucun ancien backup tant que celui
du jour n'est pas confirmé en place.

Options :
- `--dry-run` : afficher le backup retenu, la clé calculée et les purges, sans rien écrire
- `--verbose` : détailler les objets conservés et supprimés

Variables d'env requises : `SCALINGO_API_TOKEN`, `SCALINGO_APP`, `S3_BACKUP_BUCKET`

Pour restaurer : télécharger l'objet depuis le bucket, puis `pnpm cli import-backup --backup-path <fichier>`.

#### `healthcheck` — Vérifier la cohérence des résidences publiées

```bash
pnpm cli healthcheck
pnpm cli healthcheck --verbose
pnpm cli healthcheck --fetch
pnpm cli healthcheck --fetch --base-url https://monlogementetudiant.beta.gouv.fr
```

Vérifie la cohérence des résidences publiées : présence du `city_id`, validité des slugs, construction des URLs.

Options :

| Option | Description |
|--------|-------------|
| `--verbose` | Affiche le détail de chaque résidence |
| `--fetch` | Teste les URLs en HTTP (nécessite le serveur Next.js) |
| `--base-url <url>` | URL de base pour les tests HTTP (défaut : `http://localhost:3000`) |

Le process exit avec le code `1` si des erreurs sont détectées (city_id manquant, slug absent, URL en 404, etc.).

#### `healthcheck-cities` — Vérifier les pages villes en HTTP

```bash
pnpm cli healthcheck-cities
pnpm cli healthcheck-cities --verbose
pnpm cli healthcheck-cities --base-url https://monlogementetudiant.beta.gouv.fr
```

Effectue un `HEAD` sur `/trouver-un-logement-etudiant/ville/{slug}` pour chaque ville en base et reporte les erreurs HTTP (404, 500, etc.). Nécessite le serveur Next.js en cours d'exécution.

Options :

| Option | Description |
|--------|-------------|
| `--verbose` | Affiche le détail de chaque ville |
| `--base-url <url>` | URL de base pour les tests HTTP (défaut : `http://localhost:3000`) |

Le process exit avec le code `1` si des erreurs sont détectées.

#### `audit-storage` — Auditer le stockage S3

```bash
pnpm cli audit-storage
pnpm cli audit-storage --verbose
pnpm cli audit-storage --csv ./reports/ --verbose
pnpm cli audit-storage --csv ./reports/ --write
```

Audite la cohérence entre le bucket S3 et la base de données. Détecte deux types de problèmes :

- **URLs cassées** : une URL stockée dans `imagesUrls` pointe vers une clé S3 absente, ou retourne une réponse non-200 (ACL mal configuré, mauvaise construction d'URL)
- **Fichiers orphelins** : un objet existe en S3 mais n'est référencé par aucune résidence en base

Pour chaque URL en base, le script fait une requête `HEAD` HTTP pour vérifier que l'image est effectivement accessible en affichage (pas seulement que la clé existe dans S3).

Sans `--write`, tout s'exécute en dry-run : aucune modification n'est appliquée.

Options :

| Option | Description |
|--------|-------------|
| `--verbose` | Affiche le détail de chaque URL cassée et fichier orphelin |
| `--csv <dir>` | Écrit deux CSV dans le dossier : `broken-urls-{timestamp}.csv` et `unreferenced-files-{timestamp}.csv` |
| `--write` | Applique les corrections : supprime les URLs cassées des tableaux `imagesUrls` en base, supprime les fichiers orphelins de S3 |

Variables d'env requises : `DATABASE_URL`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`

---

### RAMSESE — établissements d'enseignement supérieur

Le web service RAMSESE (référentiel des établissements du MEN, passerelle Omogen) est sur le **réseau RIE** et protégé par **IP whitelistée** + **clé d'API**. Il n'est donc joignable que depuis un environnement autorisé — typiquement un **one-off Scalingo** sortant par l'IP whitelistée. Variables d'env : `RAMSESE_API_URL`, `RAMSESE_CODE_APPLICATION`, `RAMSESE_API_KEY` (envoyée en query param `api-key`).

Le bloc « Établissements à proximité » de la fiche logement s'appuie sur ce service (`src/server/services/ramsese.ts` → `getEtablissementsSuperieurByCodePostal`).

**Établissements ouverts :** `POST /v3/listeUai/filtres` n'expose pas de critère « ouvert » (les filtres utilisés sont `communes`, `natures`, `secteurs`). L'état n'est disponible qu'au détail, dans `IDENTIFICATION.ETAT` — nomenclature `1` = ouvert, `2` = à ouvrir, `3` = fermé. Le service ne conserve donc que les UAI d'état `1` à l'étape détail (un `ETAT` absent est considéré ouvert, pour ne pas vider le bloc si le champ n'est plus servi). Pour re-tester si l'API accepte un critère d'état côté filtres : `--etats 1` (un `400` = critère non supporté).

#### `verify-ramsese` — Diagnostiquer la connectivité et le parsing

```bash
pnpm cli verify-ramsese --dump                    # Créteil (94000) + payload JSON complet du 1er UAI
pnpm cli verify-ramsese --cp 75013 --dump         # Paris 13e (arrondissement INSEE résolu automatiquement)
pnpm cli verify-ramsese --insee 75113             # test direct par code INSEE (court-circuite geo.api)
pnpm cli verify-ramsese --slug <slug-residence>   # CP + coordonnées réels tirés de la BDD
pnpm cli verify-ramsese --no-natures              # diagnostic sans la liste blanche métier
pnpm cli verify-ramsese --national --json etablissements.json --concurrency 20  # liste nationale complète (sans filtre localisation) → .json
```

> `--national` court-circuite le CP/les communes et interroge `POST /v3/listeUai/filtres` sur les seules natures (liste blanche), pour obtenir tous les établissements de France. Combiné à `--json <fichier>`, il écrit la liste complète non tronquée. Les détails sont récupérés via un **pool borné** (`--concurrency <n>`, défaut 8) : jamais toutes les requêtes d'un coup, jamais en séquentiel — au plus `n` en vol. ⚠️ Périmètre national = plusieurs milliers d'appels détail ; monter la concurrence (ex. 20) pour accélérer sans saturer la passerelle, ou `--limit <n>` pour un test. Si l'étape filtres renvoie `400`, l'API n'accepte pas d'appel sans `communes` (national non supporté).

> Conçue pour un one-off Scalingo. Sur Scalingo (vars injectées, pas de fichier `.env`), lancer directement `tsx cli/index.ts verify-ramsese --dump` plutôt que `pnpm cli` (qui charge `--env-file=.env`).

Rejoue le pipeline complet de la fiche logement — code postal → communes INSEE (`geo.api.gouv.fr`, **arrondissements Paris/Lyon/Marseille inclus**) → `POST /v3/listeUai/filtres` → détails géolocalisés → distance haversine — en réutilisant le vrai code de parsing (`~/utils/geo`) et la liste blanche des natures. Affiche pour chaque UAI : nom, natures, coordonnées brutes + `SYSTEME_REFERENCE`, coordonnées reprojetées WGS84 et distance ; puis le top 5 (rendu attendu du bloc).

Codes HTTP de l'étape filtres : `200` = OK ; `401/403` = IP non whitelistée ou clé absente ; `404` = préfixe `/v3` à ajuster ; `0/5xx` = réseau/passerelle.

Options :

| Option | Description |
|--------|-------------|
| `--cp <codePostal>` | Code postal à tester (défaut : `94000`) |
| `--insee <codes>` | Codes INSEE directs séparés par des virgules (court-circuite geo.api) |
| `--slug <slug>` | Résidence : récupère CP + coordonnées depuis la BDD (prioritaire) |
| `--lat <lat>` / `--lng <lng>` | Coordonnées de la résidence pour le calcul de distance |
| `--limit <n>` | Limiter le nombre de détails UAI affichés |
| `--no-natures` | Ne pas filtrer par la liste blanche métier |
| `--dump` | Afficher le payload JSON complet du 1er UAI |

---

### Alertes étudiants (disponibilité)

Pipeline événementiel de notification des étudiants quand un logement correspondant à leur alerte devient disponible (voir `docs/adr/0001-alert-sender.md` et `0002-alert-detection.md`). Les producteurs créent des `alert_job` ; le sender les draine. Ces commandes sont les opérations **hors-ligne** du système (la détection instantanée, elle, est branchée sur les écritures via les mutations bailleur et les imports).

> **Ordre de mise en route** : `seed-alert-snapshot` une fois → (optionnel) `backfill-alert-jobs` une fois → puis `detect-alert-jobs` (réconciliation, espacée) et `send-alert-jobs` (drain, court) en cron.

#### `seed-alert-snapshot` — Amorcer la baseline du snapshot

```bash
pnpm cli seed-alert-snapshot --dry-run   # simulation
pnpm cli seed-alert-snapshot             # amorçage réel
```

Enregistre la disponibilité courante de tout le stock publié hors CROUS dans `alert_availability_snapshot`, **sans créer de job ni notifier**. À jouer **une fois avant** d'activer la détection événementielle : ensuite, « pas de ligne de snapshot » signifie « résidence réellement nouvelle ». Idempotente (upsert), rejouable sans risque.

#### `backfill-alert-jobs` — Vague initiale pour les alertes existantes

```bash
pnpm cli backfill-alert-jobs --dry-run --verbose   # chiffrer le volume sans rien écrire
pnpm cli backfill-alert-jobs                        # enfiler les jobs
```

Enfile les jobs pour le **stock déjà disponible** qui matche les **alertes existantes** (flux « pull » de masse). Sans elle, ces alertes ne seraient jamais averties du stock présent au démarrage (ni delta côté push, ni création côté pull). À jouer **une seule fois**, explicitement : c'est un envoi de masse. Ne touche pas le snapshot ; idempotente (l'index unique partiel d'`alert_job` empêche les doublons). **N'envoie rien elle-même** — c'est `send-alert-jobs` qui draine ensuite la file.

| Option | Description |
|--------|-------------|
| `--dry-run` | Simule sans enfiler de jobs |
| `--verbose` | Affiche le nombre d'alertes actives et de jobs candidats |

#### `detect-alert-jobs` — Détecter les hausses de disponibilité

```bash
pnpm cli detect-alert-jobs --dry-run --verbose
pnpm cli detect-alert-jobs
```

Compare la dispo courante au snapshot et crée un job pour chaque hausse (`dispo > 0` ET `dispo > dispo_précédente`) croisée avec une alerte active. Sert de **filet de réconciliation** : la détection instantanée est déjà branchée sur les écritures, cette commande rattrape les chemins non hookés (toggles `published`, hooks best-effort échoués). À espacer en cron (ex. 1×/nuit). Verrou single-flight en mode réel (pas de scan concurrent).

#### `send-alert-jobs` — Envoyer les emails d'alerte

```bash
pnpm cli send-alert-jobs --dry-run --verbose
pnpm cli send-alert-jobs
```

Draine la file des jobs `pending`, regroupe par étudiant (un mail listant ses résidences) et envoie via Brevo. À jouer en cron **court** (ex. `*/5 * * * *`) pour le quasi-instantané. Verrou single-flight en mode réel (pas de double-envoi si deux runs se chevauchent).

> **Garde-fou anti-spam** : `sendStudentAlertEmail` n'envoie réellement qu'en `NEXT_PUBLIC_APP_ENV === 'production'`. En dev/staging, les jobs sont traités mais aucun mail ne part.

#### `expire-alerts` — Péremption des alertes

```bash
pnpm cli expire-alerts --dry-run --verbose
pnpm cli expire-alerts
```

Cycle de vie d'une alerte, piloté par la date de référence `renewed_at` (initialisée à la création, réinitialisée à chaque **édition de critères** dans l'espace étudiant — qui renvoie aussi le template 43 de confirmation) :

1. **Relance** — à `renewed_at + 90 jours`, une alerte encore active reçoit le **template 46** et son `expiry_reminder_sent_at` est horodaté (anti-doublon).
2. **Désactivation** — 7 jours après la relance sans réaction, elle reçoit le **template 48**, son `receive_notifications` repasse à `false` et `expired_at` est horodaté.

À jouer en cron **quotidien** (`0 6 * * *`). Suivi dans `import_job` (type `alert-expiration`, visible dans l'admin « Tâches planifiées »).

> **Garde-fou anti-spam** : double verrou. La commande `return` hors production (comme `send-alert-jobs`), et `sendAlertExpiryReminderEmail` / `sendAlertDeactivationEmail` refusent aussi d'envoyer hors `NEXT_PUBLIC_APP_ENV === 'production'`. En dev/staging : aucune relance, aucune désactivation, aucun mail.

Variables d'env requises : `DATABASE_URL`, `BREVO_API_KEY`, `BREVO_TEMPLATE_ALERT_EXPIRY_REMINDER`, `BREVO_TEMPLATE_ALERT_DEACTIVATION`.

---

### Commandes d'import

Syntaxe : `pnpm cli import <type> [options]`

Options communes :
- `--dry-run` : simuler sans modifier la BDD
- `--verbose` : afficher les détails de chaque élément traité
- `--limit <n>` : limiter le nombre d'éléments importés
- `--owner-id <id>` : id du bailleur auquel rattacher les résidences (prioritaire sur le slug et le nom)
- `--owner-slug <slug>` : slug du bailleur (prioritaire sur le nom)

Résolution du bailleur : `--owner-id`, puis `--owner-slug`, puis le nom codé en dur dans la commande.
Les deux premiers sont des identifiants stables — si aucun bailleur ne correspond, la commande échoue
sans rien écrire. Le nom, lui, est éditable depuis l'admin : il ne sert que de dernier recours et crée
le bailleur s'il n'existe pas. Les crons (`cron.json`) passent par `--owner-slug`, le slug étant
identique d'un environnement à l'autre contrairement à l'id.

#### `import arpej-ibail` — Import résidences ARPEJ via API iBAIL

```bash
pnpm cli import arpej-ibail
pnpm cli import arpej-ibail --dry-run --verbose
pnpm cli import arpej-ibail --limit 10 --verbose
```

Récupère les résidences ARPEJ via l'API iBAIL (pagination automatique), géocode les adresses, télécharge et uploade les images sur S3, puis upsert les accommodations en BDD. Le matching se fait via la table `external_sources` (source=`arpej`, sourceId=clé iBAIL).

Variables d'env requises : `IBAIL_API_HOST`, `IBAIL_API_AUTH_KEY`, `IBAIL_API_AUTH_SECRET`

#### `import csv` — Import générique depuis un fichier CSV

```bash
pnpm cli import csv --file /chemin/vers/fichier.csv --source mon-source
pnpm cli import csv --file data.csv --source crous --dry-run --verbose
pnpm cli import csv --file data.csv --source crous --limit 10
```

Importe des résidences depuis un fichier CSV (délimiteur `;`). Géocode les adresses, télécharge et uploade les images sur S3, puis upsert les accommodations en BDD via la table `external_sources`.

Le CSV doit contenir au minimum : `name`, `owner_name`, `address`, `city`, `postal_code`. Colonnes optionnelles : `owner_id` / `owner_slug` (bailleur, prioritaires sur `owner_name` — lus sur la première ligne, comme `owner_name` et `owner_url`), `pictures` (URLs séparées par `|` ou retour à la ligne), types d'appartements (T1–T7), loyers, équipements (parking, laverie, cuisine…), coordonnées GPS, etc.

Options spécifiques :
- `--file <path>` (requis) : chemin vers le fichier CSV
- `--source <name>` (requis) : identifiant de la source externe

`--owner-id` / `--owner-slug` l'emportent sur les colonnes `owner_id` / `owner_slug` du fichier.

Variables d'env requises : `S3_*` (upload images)

#### `import fac-habitat` — Import résidences FAC HABITAT

```bash
pnpm cli import fac-habitat
pnpm cli import fac-habitat --file /chemin/vers/export.json
pnpm cli import fac-habitat --dry-run --verbose
pnpm cli import fac-habitat --limit 5
```

Récupère les résidences FAC HABITAT depuis un serveur SFTP (ou un fichier JSON local), géocode les adresses, mappe les typologies (Studio → T1 Bis, Duplex → T2, Duo → T3, etc.), puis upsert les accommodations en BDD.

Options spécifiques :
- `--file <path>` : utiliser un fichier JSON local au lieu du SFTP

Variables d'env requises : `FAC_HABITAT_SFTP_HOST`, `FAC_HABITAT_SFTP_USERNAME`, `FAC_HABITAT_SFTP_PASSWORD`, `FAC_HABITAT_SFTP_PORT` (défaut : 22), `S3_*` (upload images)

#### Commandes CROUS XLSX

Ces commandes utilisent le fichier XLSX CROUS contenant les onglets `Liste résidences` et `Liste types de lgt`.

```bash
pnpm cli compare-crous "/chemin/vers/Liste_des_residencesTUL.xlsx" --csv /tmp/compare-crous-report.csv
pnpm cli import crous --file "/chemin/vers/Liste_des_residencesTUL.xlsx" --dry-run --verbose
pnpm cli import-crous-typologies "/chemin/vers/Liste_des_residencesTUL.xlsx" --dry-run --verbose
pnpm cli import-crous-surfaces "/chemin/vers/Liste_des_residencesTUL.xlsx" --dry-run --verbose
pnpm cli import-crous-rents "/chemin/vers/Liste_des_residencesTUL.xlsx" --dry-run --verbose
```

`compare-crous` compare le fichier avec les résidences de l'owner `crous` en BDD. Le rapport sort une ligne par différence avec les colonnes `status`, `sourceId`, `dbId`, `dbSlug`, `residence`, `field`, `fileValue`, `dbValue`, `reason`. Pour écrire un CSV, utiliser `--csv <path>`. Pour forcer un code retour `1` en cas d'incohérence, ajouter `--exit-code`.

`import crous` est l'import CROUS complet. Il crée ou met à jour les résidences et importe aussi, par défaut, les compteurs de typologies, les compteurs de colocation, les loyers min/max et les superficies min/max depuis l'onglet `Liste types de lgt`.

Les commandes dédiées restent disponibles pour rejouer une correction ciblée sans toucher au reste de la fiche : `import-crous-typologies` met à jour uniquement les compteurs `nb_t*` et `nb_coliving_apartments`, `import-crous-surfaces` met uniquement à jour les colonnes `superficie_min/max_*` par typologie (`T1`, `T1bis`, `T2`, etc.), et `import-crous-rents` met uniquement à jour les colonnes `price_min/max_*` par typologie et recalcule `price_min`.

Par défaut, `import-crous-typologies` est non destructif : il met à jour les typologies présentes dans le fichier sans vider les compteurs absents, afin de ne pas masquer des surfaces déjà importées dans l'interface. Pour faire un remplacement strict des compteurs par le contenu du fichier, ajouter `--replace`.

Options communes :
- `--owner <name-or-slug>` : owner à comparer ou mettre à jour (défaut : `crous`)
- `--dry-run` : disponible sur les imports, simule sans écriture
- `--verbose` : affiche les résidences traitées
- `--limit <n>` : limite le nombre de résidences du fichier

Attention : dans certains exports CROUS, `uairne` n'est pas unique. Les commandes détectent ces doublons. Quand un `uairne` est unique, le matching se fait par `uairne`. Quand il est dupliqué, les imports privilégient le nom/slug et évitent d'écraser une autre résidence portant le même `uairne`. Le comparateur conserve le `sourceId` affiché, mais tient compte de ce cas pour éviter les faux rapprochements.

Le comparateur distingue aussi les écarts de nom dus au script SQL de normalisation qui retire `Résidence` en renseignant `reason=name_normalized_by_residence_sql`.

#### `upload-images` — Upload d'images locales vers S3

```bash
pnpm cli upload-images /chemin/vers/dossier --name aclef
```

Upload les images d'un dossier local vers S3, organisé par sous-dossier. Chaque sous-dossier correspond à une résidence (ex: `albert-camus/`, `l-arsenal/`). Les images sont uploadées dans `accommodations/{name}/pictures/{uuid}.{ext}`.

Le résultat affiche les URLs S3 par sous-dossier, séparées par `|` (format compatible avec la colonne `pictures` de l'import CSV).

Options :
- `--name <name>` (requis) : nom du gestionnaire (ex: `aclef`, `acm-habitat`)

Variables d'env requises : `S3_*`

---

### Commandes de sync

Syntaxe : `pnpm cli sync <type> [options]`

Options communes :
- `--dry-run` : simuler sans modifier la BDD
- `--verbose` : afficher les détails

#### `sync cities` — Synchroniser les villes

```bash
pnpm cli sync cities
pnpm cli sync cities --dry-run --verbose
```

1. Crée Paris/Marseille/Lyon si absentes (codes postaux et INSEE hardcodés)
2. Met à jour chaque ville existante via geo.api.gouv.fr (contour, EPCI, population)
3. Crée les villes manquantes à partir des accommodations publiées sans ville associée
4. **Rattrapage de toutes les communes françaises** : parcourt chaque département via `GET /departements/{code}/communes` (~101 appels API) et importe les communes absentes en base (déduplication par code INSEE). Les arrondissements de Paris/Marseille/Lyon sont ignorés (gérés à l'étape 1). Cela permet à toutes les ~35 000 communes d'apparaître dans la recherche, même sans résidence associée.

Pas de variables d'env spécifiques (utilise les APIs publiques geo.api.gouv.fr).

#### `sync rents` — Synchroniser les loyers moyens

```bash
pnpm cli sync rents
pnpm cli sync rents --dry-run --verbose
```

Télécharge le CSV des loyers prédits par EPCI depuis data.gouv.fr et met à jour le champ `average_rent` des villes correspondantes (matching par code EPCI).

Pas de variables d'env spécifiques.

#### `sync students` — Synchroniser le nombre d'étudiants

```bash
pnpm cli sync students
pnpm cli sync students --dry-run --verbose
```

Télécharge les effectifs étudiants depuis data.enseignementsup-recherche.gouv.fr (année 2023-24), puis met à jour le champ `nb_students` des villes. Le matching se fait d'abord par code INSEE, puis par nom+département en fallback.

Pas de variables d'env spécifiques.

#### `sync stats` — Synchroniser les statistiques Matomo

```bash
pnpm cli sync stats                                        # stats de la veille
pnpm cli sync stats --date 2025-03-10                      # un jour specifique
pnpm cli sync stats --from 2025-01-01                      # du 1er janvier a hier
pnpm cli sync stats --from 2025-01-01 --to 2025-03-31      # range specifique
pnpm cli sync stats --force                                # ecraser les stats existantes
pnpm cli sync stats --dry-run --verbose                    # simulation
```

Collecte les statistiques journalières (visites + events custom) depuis l'API Matomo et les stocke dans les tables `stats` et `event_stats`. Les visualisations sont disponibles dans `/administration/statistiques`.

**Mode normal (cron)** : collecte les stats de la veille. C'est le mode utilise par le cron quotidien.

**Mode batch (rattrapage)** : avec `--from` (et optionnellement `--to`), boucle sur chaque jour de la range pour backfill l'historique. Un delai de 100ms est applique entre chaque jour pour ne pas surcharger l'API Matomo.

Options :
- `--date <YYYY-MM-DD>` : collecter un jour specifique (par defaut : veille)
- `--from <YYYY-MM-DD>` : date de debut pour un sync en batch
- `--to <YYYY-MM-DD>` : date de fin pour un sync en batch (par defaut : veille)
- `--force` : ecraser les stats existantes pour la meme date
- `--dry-run` : simuler sans modifier la base

Variables d'env requises : `MATOMO_URL`, `MATOMO_TOKEN`, `MATOMO_ID_SITE`

---

### Cron jobs (Scalingo)

Les tâches planifiées sont définies dans `cron.json` à la racine. Scalingo lit ce fichier au déploiement.
Les migrations Drizzle sont appliquées au déploiement via le hook `postdeploy` défini dans `Procfile`.

| Cron | Commande | Fréquence |
|------|----------|-----------|
| `0 2 * * *` | `import arpej-ibail --owner-slug arpej` | Tous les jours à 2h |
| `30 2 * * *` | `import fac-habitat --owner-slug fac-habitat` | Tous les jours à 2h30 |
| `0 4 * * *` | `import initiall --owner-slug initiall` | Tous les jours à 4h |
| `0 1 * * 0` | `sync cities` | Dimanche à 1h |
| `0 4 1 */3 *` | `sync rents` | 1er du trimestre à 4h |
| `10 4 1 * *` | `sync students` | 1er du mois à 4h10 |
| `0 5 1 * *` | `purge-logs` | 1er du mois à 5h |
| `0 3 * * *` | `sync stats` | Tous les jours à 3h |
| `30 3 * * *` | `purge-contact-requests` | Tous les jours à 3h30 |
| `*/30 * * * *` | `send-alert-jobs` | Toutes les 30 min |
| `0 8 * * *` | `detect-alert-jobs ; expire-alerts` | Tous les jours à 8h |
| `0 5 * * *` | `backup-db` | Tous les jours à 5h (production uniquement) |

Pour vérifier les crons actifs : `scalingo --app <app> cron-tasks`
Pour voir les logs d'exécution : `scalingo --app <app> logs` (les crons tournent dans des conteneurs `one-off-*`, pas `cron-*`)

#### Alerte mail en cas d'échec

Quand un job planifié échoue, un mail part vers les adresses listées dans `CRON_FAILURE_EMAILS`
(séparées par des virgules). **La présence de cette variable est l'interrupteur** : si elle est
vide, l'échec est seulement journalisé. Il n'y a pas de garde sur l'environnement — renseigner
la variable sur staging suffit à y recevoir les alertes.

Le mail contient le nom du job, l'environnement, l'horodatage, la durée, le conteneur, le
message d'erreur et une stack tronquée. L'erreur est en parallèle envoyée à Sentry.

Deux natures d'échec déclenchent l'alerte :

- **Crash net** — toute exception non rattrapée qui remonte jusqu'à `cli/index.ts`.
- **Échec partiel** — le job termine mais des éléments sont passés à la trappe : `result.errors`
  non vide pour les imports et syncs, alertes étudiantes ayant épuisé leurs `MAX_ATTEMPTS`
  tentatives pour `send-alert-jobs`. Le job sort alors en code 1 et apparaît en échec sur
  Scalingo, même si sa ligne `import_job` reste en `done` avec son résumé détaillé.

Il n'y a **pas d'anti-flood** : un échec = un mail. Un job qui casse durablement enverra donc
autant de mails qu'il a d'exécutions (jusqu'à 48/jour pour `send-alert-jobs`).

Seules les commandes listées dans `CRON_COMMANDS` (`cli/cron-failure.ts`) notifient — un one-off
lancé à la main affiche déjà son erreur dans le terminal. `cron-failure.test.ts` échoue si une
commande de `cron.json` manque à cette liste.

**Ce qui n'est pas couvert** — le mail suppose que le process JS vit assez longtemps pour
l'envoyer :

- conteneur tué de l'extérieur (OOM, timeout) : aucun handler ne s'exécute ;
- cron jamais déclenché (planification cassée) : rien ne détecte une absence d'exécution ;
- crash à la validation des variables d'env, qui a lieu à l'import des modules donc avant le
  `try/catch` — cas de toute façon visible, puisqu'il ferait aussi tomber le site.

Pour valider la chaîne de bout en bout après un déploiement :

```bash
scalingo -a <app> --region osc-secnum-fr1 run npx tsx cli/index.ts cron-selftest
```

Cette commande lève une erreur volontaire, ne touche ni la base ni aucune API métier, et n'est
pas planifiée.

### Variables d'environnement CLI

Toutes les variables sont dans `.env.dist`. Celles spécifiques au CLI :

| Variable | Utilisée par |
|----------|-------------|
| `DATABASE_URL` | Toutes les commandes |
| `CRON_FAILURE_EMAILS` | Alerte d'échec de tous les jobs planifiés (liste séparée par des virgules, vide = pas d'envoi) |
| `SCALINGO_API_TOKEN` | `import-backup`, `backup-db` |
| `SCALINGO_APP` | `import-backup`, `backup-db` |
| `S3_BACKUP_BUCKET` | `backup-db` (production uniquement) |
| `IBAIL_API_HOST` | `import arpej-ibail` |
| `IBAIL_API_AUTH_KEY` | `import arpej-ibail` |
| `IBAIL_API_AUTH_SECRET` | `import arpej-ibail` |
| `MATOMO_URL` | `sync stats` |
| `MATOMO_TOKEN` | `sync stats` |
| `MATOMO_ID_SITE` | `sync stats` |
| `FAC_HABITAT_SFTP_HOST` | `import fac-habitat` |
| `FAC_HABITAT_SFTP_USERNAME` | `import fac-habitat` |
| `FAC_HABITAT_SFTP_PASSWORD` | `import fac-habitat` |
| `FAC_HABITAT_SFTP_PORT` | `import fac-habitat` |
| `S3_*` | `import arpej-ibail`, `import csv`, `import fac-habitat`, `upload-images`, `audit-storage` |

## Architecture

```
src/
  app/
    layout.tsx                  # Root layout (providers : DSFR, i18n, React Query, nuqs)
    (public)/                   # Routes publiques (header + footer)
      trouver-un-logement-etudiant/   # Recherche logements
      preparer-sa-vie-etudiante/      # Contenu éditorial
    (authenticated)/            # Routes authentifiées
      mon-espace/               # Espace étudiant
      bailleur/                 # Espace bailleur
    (widget)/                   # Widget iframe (layout minimal, pas de header/footer)
      widget/logements/         # Grille de résidences embarquable
    api/trpc/                   # Route handler tRPC (HTTP + server-side caller)
  components/
    find-student-accomodation/  # Composants recherche logement (cards, filtres, autocomplete)
    widget/                     # Composants spécifiques widget
    map/                        # Carte Leaflet
    ui/                         # Composants génériques (skeleton, footer, header)
    shared/                     # Composants partagés (badges)
  hooks/                        # Hooks React (useFavorites, useAlerts, useCreateResidence…)
  server/
    accommodations/             # Queries SSR accommodations (get, prefetch, detail)
    bailleur/                   # Queries SSR bailleur (mes résidences, detail)
    student/                    # Queries SSR étudiant (alertes, favoris)
    territories/                # Queries SSR territoires (villes, académies, départements)
    questions-answers/          # Queries SSR Q&A
    db/
      schema/                   # Schéma Drizzle (accommodations, owners, alerts, auth…)
    trpc/
      init.ts                   # Contexte tRPC (auth, DB)
      router.ts                 # Router racine (merge des sous-routers)
      routers/                  # Sous-routers tRPC
        accommodations.ts       #   CRUD accommodations (recherche, detail)
        bailleur.ts             #   CRUD bailleur (résidences, images)
        alerts.ts               #   Alertes étudiants
        favorites.ts            #   Favoris
        territories.ts          #   Territoires (villes, départements, académies)
        questions-answers.ts    #   Q&A
      utils/                    # Helpers tRPC (accommodation-helpers)
    services/                   # Services partagés (S3)
    utils/                      # Utilitaires serveur (normalize-city-search)
  lib/                          # Libs partagées (email, django-password, types)
  schemas/                      # Schémas Zod (accommodations, territories)
  providers/                    # Providers React (TanStack Query)
  dsfr/                         # Config DSFR (provider, head, color scheme)
  utils/                        # Utilitaires client
cli/
  index.ts                      # Point d'entrée CLI (commander)
  commands/                     # Commandes CLI (migrate-users, import-backup, imports, syncs)
  lib/                          # Libs CLI (scalingo-backup, db-utils, geocoder, matomo)
drizzle/                        # Migrations SQL Drizzle
public/
  widget/
    embed.js                          # Script d'embed — widget logements
    embed-simulateur-aides.js         # Script d'embed — widget simulateur d'aides
    embed-calculatrice.js             # Script d'embed — widget calculatrice de budget
    test.html                         # Page de test — widget logements
    test-simulateur-aides.html        # Page de test — widget simulateur d'aides
    test-calculatrice.html            # Page de test — widget calculatrice de budget
```

## API publique v1

API REST en lecture seule exposant le catalogue de résidences étudiantes et les territoires, pour des consommateurs tiers. Le contenu est **iso avec la carte** (mêmes filtres, même shape GeoJSON), servi en JSON pur (pas de superjson).

Implémentation : [Hono](https://hono.dev) + `@hono/zod-openapi` monté sur un catch-all Next (`src/app/api/v1/[[...route]]/route.ts`), logique de requête partagée avec tRPC via `src/server/accommodations/list-query.ts`.

### Documentation interactive (Scalar / OpenAPI)

- **Doc Scalar** : `GET /api/v1/docs`
- **Spec OpenAPI 3.1** : `GET /api/v1/openapi.json`

Ces deux routes sont publiques (sans clé). Tous les endpoints de **données** requièrent une clé.

### Authentification

Une clé d'API est requise dans l'en-tête `x-api-key` :

```bash
curl -H 'x-api-key: mle_xxxxx' 'https://<host>/api/v1/accommodations?city_slugs=paris,lyon'
```

Les clés sont émises et gérées par un admin dans **`/administration` → onglet « Consommateurs »** (création, quota, activation/désactivation, révocation, statistiques). La clé en clair n'est affichée **qu'une seule fois** à la création. Réponses : `401` (clé absente/invalide), `429` (quota dépassé).

Techniquement, les clés sont gérées par le plugin `@better-auth/api-key` (table `apikey`), qui assure le hashing et le rate-limit par clé, stocké en PostgreSQL (cohérent en multi-instance).

**Rate-limit** : chaque clé porte un quota `N requêtes / fenêtre de T secondes` (défaut global via `API_V1_*`, surchargeable par consommateur). Au dépassement → `429`.

**Statistiques de consommation** : chaque requête authentifiée incrémente un agrégat journalier (table `api_key_usage_daily`, une ligne par clé et par jour). L'onglet Consommateurs affiche le total sur 30 jours et le détail jour par jour (bouton « Stats »), permettant de suivre le volume de trafic par période et par consommateur.

### Endpoints

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/accommodations` | Liste paginée filtrée (FeatureCollection GeoJSON) |
| `GET` | `/api/v1/accommodations/nearby` | Résidences à proximité (`center=lng,lat` ou `city=slug`) |
| `GET` | `/api/v1/accommodations/{slug}` | Détail d'une résidence |
| `GET` | `/api/v1/cities` | Villes + slugs (filtres `department`, `popular`, `search`) |
| `GET` | `/api/v1/departments` | Départements (slug, code) — filtre `search` |
| `GET` | `/api/v1/academies` | Académies (slug) — filtre `search` |
| `GET` | `/api/v1/territories/search` | Recherche libre de territoires (`q`) |
| `GET` | `/api/v1/openapi.json` | Spec OpenAPI (public) |
| `GET` | `/api/v1/docs` | Doc Scalar (public) |

Les endpoints territoires acceptent un paramètre `search` (recherche insensible à la casse sur le `nom`) : `GET /api/v1/cities?search=gren`, `.../departments?search=isère`, `.../academies?search=lyon`.

### Filtres de `GET /api/v1/accommodations`

Query params (les listes sont séparées par des virgules) :

| Paramètre | Type | Description |
|---|---|---|
| `city_slugs` | CSV | Slugs de villes (filtre géométrique `ST_Within`, iso carte) |
| `department` | CSV | Départements par **code** ou slug |
| `academie` | CSV | Slugs d'académies |
| `postal_codes` | CSV | Codes postaux (filtre attributaire) |
| `bbox` | string | `xmin,ymin,xmax,ymax` (WGS84) |
| `center` + `radius` | string + km | Recherche par rayon |
| `price_max` | int | Loyer minimum maximal (€/mois) |
| `crous` | bool | Absent = **toutes** · `true` = CROUS seul · `false` = hors CROUS |
| `accessible` | bool | Logements PMR uniquement |
| `coliving` | bool | Colocation uniquement |
| `available` | bool | Avec disponibilités uniquement |
| `owner_slug` | string | Slug d'un gestionnaire/bailleur |
| `page` / `page_size` | int | Pagination (`page_size` max 100) |

Les dimensions de localisation fournies (`city_slugs`/`department`/`academie`/`postal_codes`) sont combinées en **union (OR)**.

### Variables d'environnement

À ajouter dans `.env` (valeurs par défaut dans `.env.dist`) :

| Variable | Défaut | Description |
|---|---|---|
| `API_V1_ENABLED` | `true` | Active/désactive l'API v1 (désactivée → `404` sur `/api/v1/*`) |
| `API_V1_RATE_LIMIT_MAX` | `120` | Nombre de requêtes autorisées par fenêtre, par défaut, pour chaque clé (surchargeable par clé) |
| `API_V1_RATE_LIMIT_WINDOW_MS` | `60000` | Durée de la fenêtre de rate-limit en millisecondes |

## Widget iframe — Logements

Widget embarquable qui affiche une grille de résidences étudiantes sur des sites partenaires.

### Intégration

Une seule ligne à fournir au partenaire :

```html
<script src="https://monlogementetudiant.beta.gouv.fr/widget/embed.js" data-city="Paris"></script>
```

Le script crée automatiquement l'iframe et gère le redimensionnement dynamique.

### Paramètres

| Attribut | Description | Exemple |
|---|---|---|
| `data-city` | Ville (résolue en bbox automatiquement) | `data-city="Paris"` |
| `data-bbox` | Bounding box manuelle (west,south,east,north) | `data-bbox="2.2,48.8,2.5,48.9"` |
| `data-prix` | Budget max en euros | `data-prix="800"` |
| `data-crous` | CROUS uniquement | `data-crous="true"` |
| `data-colocation` | Colocation uniquement | `data-colocation="true"` |
| `data-accessible` | Logements PMR | `data-accessible="true"` |
| `data-filters` | Filtres à afficher (tous par défaut). `"false"` masque tout. Liste séparée par des virgules parmi `ville`, `prix`, `colocation`, `crous`, `accessible` | `data-filters="ville,prix,colocation"` |
| `data-page` | Page de pagination | `data-page="2"` |
| `data-gestionnaire` | Filtrer par slug du gestionnaire/bailleur | `data-gestionnaire="promologis-2"` |
| `data-target` | ID de l'élément où déposer l'iframe | `data-target="widget-container"` |

Si `data-city` ou `data-bbox` est fourni, le champ de recherche de localisation est masqué.

Les filtres sont **tous visibles par défaut**. Pour n'en afficher que certains, passer une liste séparée par des virgules : `data-filters="ville,prix"`. Pour tout masquer : `data-filters="false"`. Valeurs disponibles : `ville`, `prix`, `colocation`, `crous`, `accessible`.

### Comportement du widget

- **Pagination** : 6 résidences par page
- **Titre dynamique** : "Trouver un logement à [ville]" avec contractions françaises (au Mans, aux Lilas, à Paris). Sans ville : "Trouver un logement étudiant"

### Exemples

```html
<!-- Paris, budget max 800€ -->
<script src="https://monlogementetudiant.beta.gouv.fr/widget/embed.js" data-city="Paris" data-prix="800"></script>

<!-- Lyon, CROUS uniquement, sans filtres -->
<script src="https://monlogementetudiant.beta.gouv.fr/widget/embed.js" data-city="Lyon" data-crous="true" data-filters="false"></script>

<!-- Bbox manuelle, colocation -->
<script src="https://monlogementetudiant.beta.gouv.fr/widget/embed.js" data-bbox="2.2,48.8,2.5,48.9" data-colocation="true"></script>

<!-- Logements d'un gestionnaire spécifique -->
<script src="https://monlogementetudiant.beta.gouv.fr/widget/embed.js" data-gestionnaire="promologis-2"></script>

<!-- Afficher uniquement les filtres ville, prix et colocation -->
<script src="https://monlogementetudiant.beta.gouv.fr/widget/embed.js" data-filters="ville,prix,colocation"></script>

<!-- Iframe déposée dans un élément spécifique -->
<div id="mon-widget"></div>
<script src="https://monlogementetudiant.beta.gouv.fr/widget/embed.js" data-city="Toulouse" data-target="mon-widget"></script>
```

### Test local

```bash
pnpm dev
open /tmp/widget-test.html   # ou copier public/widget/test.html en dehors du projet
```

Ouvrir le fichier test en `file://` (pas via localhost) pour simuler un vrai contexte cross-origin.

### Fonctionnement technique

- Le widget est servi via la route group `(widget)` avec un layout minimal (pas de header/footer/nav/Matomo)
- `embed.js` crée l'iframe et écoute les `postMessage` pour ajuster la hauteur dynamiquement
- Le body de l'iframe a `overflow: hidden` — pas de double scrollbar, le scroll est géré par la page parente
- Les cards ouvrent la page détail sur le site principal dans un nouvel onglet
- Les headers `X-Frame-Options` et `Content-Security-Policy: frame-ancestors *` sont configurés dans `next.config.mjs` pour autoriser l'embedding

## Widget iframe — Simulateur d'aides

Widget embarquable qui affiche le simulateur d'aides au logement (éligibilité CAF, APL, etc.) sur des sites partenaires.

### Intégration

```html
<script src="https://monlogementetudiant.beta.gouv.fr/widget/embed-simulateur-aides.js"></script>
```

Le simulateur gère son propre state interne (navigation par étapes), aucun paramètre de configuration n'est requis.

### Paramètres

| Attribut | Description | Exemple |
|---|---|---|
| `data-target` | ID de l'élément où déposer l'iframe | `data-target="mon-widget"` |

### Exemple

```html
<!-- Insertion dans un conteneur spécifique -->
<div id="mon-widget"></div>
<script src="https://monlogementetudiant.beta.gouv.fr/widget/embed-simulateur-aides.js" data-target="mon-widget"></script>
```

## Widget iframe — Calculatrice de budget

Widget embarquable qui affiche la calculatrice de budget étudiant (revenus, dépenses, résumé mensuel) sur des sites partenaires.

### Intégration

```html
<script src="https://monlogementetudiant.beta.gouv.fr/widget/embed-calculatrice.js"></script>
```

La calculatrice gère son propre state interne, aucun paramètre de configuration n'est requis.

### Paramètres

| Attribut | Description | Exemple |
|---|---|---|
| `data-target` | ID de l'élément où déposer l'iframe | `data-target="mon-widget"` |

### Exemple

```html
<!-- Insertion dans un conteneur spécifique -->
<div id="mon-widget"></div>
<script src="https://monlogementetudiant.beta.gouv.fr/widget/embed-calculatrice.js" data-target="mon-widget"></script>
```

### Test local (simulateur d'aides et calculatrice)

Même procédure que pour le widget logements : lancer `pnpm dev` puis ouvrir `public/widget/test-simulateur-aides.html` ou `public/widget/test-calculatrice.html` en `file://`.

## Maintainers

- [@KGALLET](https://github.com/KGALLET)
