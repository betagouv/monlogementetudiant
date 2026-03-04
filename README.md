# Mon Logement Etudiant - Client

Plateforme qui aide les etudiants a trouver un logement.

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

## Base de donnees

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

Outil CLI pour les operations de maintenance :

```bash
pnpm cli <command>
```

### `migrate-users` — Migrer les users Django vers better-auth

```bash
pnpm cli migrate-users --file <path-to-django-dump.json>
```

Insere les users et accounts dans les tables better-auth, puis lie les owners existants par nom. (Utile lors de la migration Django vers trpc + drizzle, mais une fois migration terminée, script inutile.)

### `import-backup` — Importer un backup Scalingo

```bash
pnpm cli import-backup
```

Telecharge le dernier backup Scalingo, restore dans la DB locale et applique les migrations Drizzle.

Options :
- `--backup-path <path>` : utiliser un fichier backup local
- `--skip-download` : reutiliser un backup deja telecharge dans `/tmp/jde-backup/`

Variables d'env requises : `SCALINGO_API_TOKEN`, `SCALINGO_APP`, `SCALINGO_DB_ADDON_ID`

## Architecture

```
src/
  app/
    layout.tsx                  # Root layout (providers : DSFR, i18n, React Query, nuqs)
    (public)/                   # Routes publiques (header + footer)
      trouver-un-logement-etudiant/   # Recherche logements
      preparer-sa-vie-etudiante/      # Contenu editorial
    (authenticated)/            # Routes authentifiees
      mon-espace/               # Espace etudiant
      bailleur/                 # Espace bailleur
    (widget)/                   # Widget iframe (layout minimal, pas de header/footer)
      widget/logements/         # Grille de residences embarquable
    api/trpc/                   # Route handler tRPC (HTTP + server-side caller)
  components/
    find-student-accomodation/  # Composants recherche logement (cards, filtres, autocomplete)
    widget/                     # Composants specifiques widget
    map/                        # Carte Leaflet
    ui/                         # Composants generiques (skeleton, footer, header)
    shared/                     # Composants partages (badges)
  hooks/                        # Hooks React (useFavorites, useAlerts, useCreateResidence…)
  server/
    accommodations/             # Queries SSR accommodations (get, prefetch, detail)
    bailleur/                   # Queries SSR bailleur (mes residences, detail)
    student/                    # Queries SSR etudiant (alertes, favoris)
    territories/                # Queries SSR territoires (villes, academies, departements)
    questions-answers/          # Queries SSR Q&A
    db/
      schema/                   # Schema Drizzle (accommodations, owners, alerts, auth…)
    trpc/
      init.ts                   # Contexte tRPC (auth, DB)
      router.ts                 # Router racine (merge des sous-routers)
      routers/                  # Sous-routers tRPC
        accommodations.ts       #   CRUD accommodations (recherche, detail)
        bailleur.ts             #   CRUD bailleur (residences, images)
        alerts.ts               #   Alertes etudiants
        favorites.ts            #   Favoris
        territories.ts          #   Territoires (villes, departements, academies)
        questions-answers.ts    #   Q&A
      utils/                    # Helpers tRPC (accommodation-helpers)
    services/                   # Services partages (S3)
    utils/                      # Utilitaires serveur (normalize-city-search)
  lib/                          # Libs partagees (email, django-password, types)
  schemas/                      # Schemas Zod (accommodations, territories)
  providers/                    # Providers React (TanStack Query)
  dsfr/                         # Config DSFR (provider, head, color scheme)
  utils/                        # Utilitaires client
cli/
  index.ts                      # Point d'entree CLI (commander)
  commands/                     # Commandes CLI (migrate-users, import-backup)
  lib/                          # Libs CLI (scalingo-backup, db-utils)
drizzle/                        # Migrations SQL Drizzle
public/
  widget/
    embed.js                    # Script d'embed pour les partenaires
    test.html                   # Page de test du widget
```

## Widget iframe

Widget embarquable qui affiche une grille de résidences etudiantes sur des sites partenaires.

### Integration

Une seule ligne a fournir au partenaire :

```html
<script src="https://monlogementetudiant.beta.gouv.fr/widget/embed.js" data-city="Paris"></script>
```

Le script crée automatiquement l'iframe et gère le redimensionnement dynamique.

### Parametres

| Attribut | Description | Exemple |
|---|---|---|
| `data-city` | Ville (resolue en bbox automatiquement) | `data-city="Paris"` |
| `data-bbox` | Bounding box manuelle (west,south,east,north) | `data-bbox="2.2,48.8,2.5,48.9"` |
| `data-prix` | Budget max en euros | `data-prix="800"` |
| `data-crous` | CROUS uniquement | `data-crous="true"` |
| `data-colocation` | Colocation uniquement | `data-colocation="true"` |
| `data-accessible` | Logements PMR | `data-accessible="true"` |
| `data-filters` | Afficher/masquer les filtres (visible par defaut) | `data-filters="false"` |
| `data-page` | Page de pagination | `data-page="2"` |
| `data-target` | ID de l'element ou deposer l'iframe | `data-target="widget-container"` |

Si `data-city` ou `data-bbox` est fourni, le champ de recherche de localisation est masque.

Les filtres sont **visibles par defaut**. Pour les masquer, utiliser `data-filters="false"`.

### Comportement du widget

- **Pagination** : 6 residences par page
- **Titre dynamique** : "Trouver un logement a [ville]" avec contractions francaises (au Mans, aux Lilas, a Paris). Sans ville : "Trouver un logement etudiant"

### Exemples

```html
<!-- Paris, budget max 800€ -->
<script src="https://monlogementetudiant.beta.gouv.fr/widget/embed.js" data-city="Paris" data-prix="800"></script>

<!-- Lyon, CROUS uniquement, sans filtres -->
<script src="https://monlogementetudiant.beta.gouv.fr/widget/embed.js" data-city="Lyon" data-crous="true" data-filters="false"></script>

<!-- Bbox manuelle, colocation -->
<script src="https://monlogementetudiant.beta.gouv.fr/widget/embed.js" data-bbox="2.2,48.8,2.5,48.9" data-colocation="true"></script>

<!-- Iframe deposee dans un element specifique -->
<div id="mon-widget"></div>
<script src="https://monlogementetudiant.beta.gouv.fr/widget/embed.js" data-city="Toulouse" data-target="mon-widget"></script>
```

### Test local

```bash
pnpm dev
open /tmp/widget-test.html bun   # ou copier public/widget/test.html en dehors du projet
```

Ouvrir le fichier test en `file://` (pas via localhost) pour simuler un vrai contexte cross-origin.

### Fonctionnement technique

- Le widget est servi via la route group `(widget)` avec un layout minimal (pas de header/footer/nav/Matomo)
- `embed.js` cree l'iframe et ecoute les `postMessage` pour ajuster la hauteur dynamiquement
- Le body de l'iframe a `overflow: hidden` — pas de double scrollbar, le scroll est gere par la page parente
- Les cards ouvrent la page detail sur le site principal dans un nouvel onglet
- Les headers `X-Frame-Options` et `Content-Security-Policy: frame-ancestors *` sont configures dans `next.config.mjs` pour autoriser l'embedding

## Maintainers

- [@KGALLET](https://github.com/KGALLET)
