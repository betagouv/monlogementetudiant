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
    geocoder.ts          # Géocodage BAN + geo.api.gouv.fr
    matomo.ts            # Service API Matomo
  commands/
    migrate-users.ts     # Migration users Django
    import-backup.ts     # Import backup Scalingo
    import-arpej-ibail.ts # Import résidences ARPEJ (API iBAIL)
    import-csv.ts        # Import générique depuis CSV
    import-fac-habitat.ts # Import résidences FAC HABITAT (SFTP)
    upload-images.ts     # Upload images locales vers S3
    sync-cities.ts       # Sync villes (geo.api.gouv.fr) + rattrapage toutes communes
    sync-rents.ts        # Sync loyers moyens (data.gouv.fr)
    sync-students.ts     # Sync nb étudiants (enseignementsup)
    sync-stats.ts        # Sync stats Matomo
```

---

### Commandes standalone

#### `migrate-users` — Migrer les users Django vers better-auth

```bash
pnpm cli migrate-users
```

Lit les tables Django existantes dans la BDD locale (typiquement après un `import-backup`) et traduit les utilisateurs vers le schéma better-auth : insertion dans les tables `user` et `account`, puis liaison des owners existants par correspondance de nom, et liaisons des utilisateurs students.

À utiliser une seule fois après la migration Django → tRPC/Drizzle.

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

Variables d'env requises : `SCALINGO_API_TOKEN`, `SCALINGO_APP`, `SCALINGO_DB_ADDON_ID`

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

---

### Commandes d'import

Syntaxe : `pnpm cli import <type> [options]`

Options communes :
- `--dry-run` : simuler sans modifier la BDD
- `--verbose` : afficher les détails de chaque élément traité
- `--limit <n>` : limiter le nombre d'éléments importés

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

Le CSV doit contenir au minimum : `name`, `owner_name`, `address`, `city`, `postal_code`. Colonnes optionnelles : `pictures` (URLs séparées par `|` ou retour à la ligne), types d'appartements (T1–T7), loyers, équipements (parking, laverie, cuisine…), coordonnées GPS, etc.

Options spécifiques :
- `--file <path>` (requis) : chemin vers le fichier CSV
- `--source <name>` (requis) : identifiant de la source externe

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

#### `upload-images` — Upload d'images locales vers S3

```bash
pnpm cli upload-images /chemin/vers/dossier --name aclef
```

Upload les images d'un dossier local vers S3, organisé par sous-dossier. Chaque sous-dossier correspond à une résidence (ex: `albert-camus/`, `l-arsenal/`). Les images sont uploadées dans `accommodations{S3_SUFFIX_DIR}/{name}/pictures/{uuid}.{ext}`.

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
| `0 2 * * *` | `import arpej-ibail` | Tous les jours à 2h |
| `0 1 * * 0` | `sync cities` | Dimanche à 1h |
| `0 4 1 * *` | `sync rents` | 1er du mois à 4h |
| `10 4 1 * *` | `sync students` | 1er du mois à 4h10 |
| `0 3 * * *` | `sync stats` | Tous les jours à 3h |

Pour vérifier les crons actifs : `scalingo --app <app> cron-tasks`
Pour voir les logs d'exécution : `scalingo --app <app> logs --filter cron`

### Variables d'environnement CLI

Toutes les variables sont dans `.env.dist`. Celles spécifiques au CLI :

| Variable | Utilisée par |
|----------|-------------|
| `DATABASE_URL` | Toutes les commandes |
| `SCALINGO_API_TOKEN` | `import-backup` |
| `SCALINGO_APP` | `import-backup` |
| `SCALINGO_DB_ADDON_ID` | `import-backup` |
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
| `S3_*` | `import arpej-ibail`, `import csv`, `import fac-habitat`, `upload-images` |

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
    embed.js                    # Script d'embed pour les partenaires
    test.html                   # Page de test du widget
```

## Widget iframe

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

## Maintainers

- [@KGALLET](https://github.com/KGALLET)
