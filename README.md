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
DATABASE_URL=postgres://jde:jde@localhost:5433/jde_dev
DATABASE_URL_TEST=postgres://test:test@localhost:5434/jde_test
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
    sync-cities.ts       # Sync villes (geo.api.gouv.fr)
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
pnpm cli sync stats
pnpm cli sync stats --date 2025-03-10
pnpm cli sync stats --force
pnpm cli sync stats --dry-run --verbose
```

Collecte les statistiques journalières (visites + events) depuis l'API Matomo et les stocke dans les tables `stats_stats` et `stats_eventstats`.

Par défaut, collecte les stats de la veille. Les agrégations par semaine/mois sont faites dans Metabase.

Options spécifiques :
- `--date <YYYY-MM-DD>` : collecter un jour spécifique (par défaut : veille)
- `--force` : écraser les stats existantes pour la même date

Variables d'env requises : `MATOMO_URL`, `MATOMO_TOKEN`, `MATOMO_ID_SITE`

---

### Cron jobs (Scalingo)

Les tâches planifiées sont définies dans `cron.json` à la racine. Scalingo lit ce fichier au déploiement.

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
| `S3_*` | `import arpej-ibail` (upload images) |

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
| `data-filters` | Afficher/masquer les filtres (visible par défaut) | `data-filters="false"` |
| `data-page` | Page de pagination | `data-page="2"` |
| `data-target` | ID de l'élément où déposer l'iframe | `data-target="widget-container"` |

Si `data-city` ou `data-bbox` est fourni, le champ de recherche de localisation est masqué.

Les filtres sont **visibles par défaut**. Pour les masquer, utiliser `data-filters="false"`.

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
