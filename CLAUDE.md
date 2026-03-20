# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexte

Mon Logement Étudiant (MLE) est une plateforme beta.gouv.fr qui aide les étudiants à trouver un logement. Le site agrège des résidences étudiantes de différentes sources (CROUS, bailleurs sociaux, privés) et permet aux étudiants de chercher, filtrer, et candidater.

### Utilisateurs

| Rôle | Accès | Fonctionnalités |
|------|-------|-----------------|
| **Étudiant** | `/mon-espace` | Recherche logements, alertes email, favoris, connexion DossierFacile |
| **Gestionnaire/Bailleur** | `/bailleur` | Gestion résidences, publication logements, suivi candidatures |
| **Admin** | `/administration` | Gestion users/owners, modération, dashboard stats |

### Sources de données

- **CROUS** - Import CSV manuel
- **ARPEJ** - API iBAIL automatisée (cron quotidien)
- **FAC Habitat** - SFTP automatisé
- **Bailleurs directs** - Saisie via interface `/bailleur`

## Commandes

```bash
pnpm dev                    # Dev server
pnpm build                  # Build prod
pnpm lint                   # Biome check
pnpm test:unit              # Tests unitaires (rapide)
pnpm test:integration       # Tests intégration (nécessite DB Docker)
pnpm drizzle-kit migrate    # Appliquer migrations
pnpm cli <command>          # CLI maintenance (voir README.md)
```

### Setup DB locale

```bash
docker compose up -d        # PostGIS sur port 5433 (dev) et 5434 (test)
pnpm drizzle-kit migrate
```

## Architecture

```
src/
  app/
    (public)/                    # Pages publiques (recherche, landing)
    (authenticated)/
      mon-espace/                # Espace étudiant
      bailleur/                  # Espace gestionnaire
      administration/            # Back-office admin
    (widget)/                    # Widget iframe embarquable
    api/trpc/                    # Handler tRPC
  server/
    trpc/routers/                # API par domaine
    db/schema/                   # Schéma Drizzle + PostGIS
  components/                    # Organisés par feature
cli/                             # Import/sync commands
```

## Conventions

### Code
- **Imports**: `~` = `src/` (ex: `import { db } from '~/server/db'`)
- **Style**: Biome - single quotes, no semicolons, 140 chars
- **CSS**: Modules + DSFR, combiner avec `clsx()`

### Base de données
- **Nommage tables**: `module_table` (ex: `accommodation_accommodation`, `territories_city`)
- **Géométrie**: PostGIS avec SRID 4326 pour toutes les coordonnées

### tRPC
4 niveaux de procédures selon les droits:
- `baseProcedure` - Public
- `protectedProcedure` - Connecté
- `ownerProcedure` - Gestionnaire ou admin
- `adminProcedure` - Admin uniquement

### Tests
- **Unit**: `*.test.ts` - pas de DB
- **Integration**: `*.integration.test.ts` - DB sur port 5434
- **Factories**: `src/__tests__/fixtures/factories.ts`
- **Callers**: `caller` (anon), `authenticatedCaller`, `ownerCaller`, `adminCaller`

## Voir aussi

- `@README.md` - Documentation CLI complète, widget, architecture détaillée
- `@messages/fr.json` - Traductions (next-intl)
- `@ADR/` - Architecture Decision Records (décisions techniques, conventions)
