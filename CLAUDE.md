# CLAUDE.md — Conventions du projet Mon Logement Étudiant

## Stack

Next.js (App Router) · TypeScript · tRPC · Drizzle ORM · PostgreSQL · Zod · Better Auth · DSFR · Vitest

---

## Structure

```
src/
  app/          # Pages Next.js (App Router)
  server/
    db/         # Drizzle schema + instance
    services/   # Appels APIs externes
    trpc/       # Routers tRPC
    env.ts      # Variables d'env validées par Zod
  components/   # Composants React
  schemas/      # Schémas Zod partagés
  hooks/        # Custom hooks (React Query / tRPC)
  utils/        # Utilitaires partagés
  enums/        # Énumérations TypeScript
cli/            # Scripts Node.js (imports CSV, SFTP, etc.)
```

---

## Validation — Zod

**Toute donnée externe doit être validée par Zod** : réponses d'API, inputs utilisateur, webhooks. Ne jamais utiliser un `type` ou `interface` TypeScript seul pour modéliser des données non maîtrisées.

**Convention de nommage :**
- Schéma : `Z<NomDomaine>` — ex. `ZGetAccommodationsResponse`
- Type inféré : `T<NomDomaine>` — ex. `type TGetAccommodationsResponse = z.infer<typeof ZGetAccommodationsResponse>`

**Localisation :** `/src/schemas/<domaine>/` pour les schémas partagés. Les schémas internes à un service (ex. forme de réponse d'une API tierce) restent dans le fichier du service, non exportés.

**Parsing des réponses API :**
- Utiliser `.safeParse()` et gérer l'échec explicitement (retour `null`, `[]`, ou throw selon le contexte)
- Ne pas utiliser de cast TypeScript (`as MonType`) sur des données non validées

```ts
const result = MySchema.safeParse(data)
if (!result.success) return []
```

**Messages d'erreur :** toujours en français.

```ts
z.string().min(1, { message: 'Veuillez saisir votre email' })
```

---

## Variables d'environnement

Toutes les vars sont déclarées et validées dans `src/server/env.ts` via Zod.

**Règles :**
- Les valeurs dans `.env` sont **brutes** — ne pas précalculer des dérivées (hash, URL composée) à la main dans le code. Si une var est dérivée d'autres (ex. base64 de deux vars), la déclarer directement dans `.env` comme valeur précalculée.
- Utiliser `requiredInProd` pour les vars optionnelles en dev mais obligatoires en prod/staging.
- Utiliser `requiredInProdUrl` pour les URLs.
- Mettre à jour `.env.dist` avec des valeurs factices à chaque ajout/suppression de variable.
- Nommer les vars en `SCREAMING_SNAKE_CASE` avec un préfixe par service : `BREVO_*`, `S3_*`, `CRISP_*`, `IBAIL_*`, etc.
- Ajouter les vars manquantes dans les `env` de `vitest.config.ts` pour éviter les échecs à l'initialisation des tests.

---

## Sécurité — HTML externe

Ne jamais utiliser `dangerouslySetInnerHTML` sans sanitisation préalable.

- **Côté serveur** (services, Server Components) : utiliser `isomorphic-dompurify`
- **Côté client** : utiliser l'utilitaire `sanitizeHTML` de `src/utils/sanitize-html.ts`

```ts
// Serveur
import DOMPurify from 'isomorphic-dompurify'
const safe = DOMPurify.sanitize(html)

// Client
import { sanitizeHTML } from '~/utils/sanitize-html'
<div dangerouslySetInnerHTML={{ __html: sanitizeHTML(html) }} />
```

Préférer sanitiser le plus tôt possible (au fetch, pas au render).

---

## UI — DSFR et styles

**Ordre de priorité strict :**

1. **Composant DSFR** — toujours chercher en premier dans `@codegouvfr/react-dsfr` (Button, Input, Modal, Badge, Tabs, Accordion, etc.)
2. **Classe utilitaire DSFR** — si pas de composant adapté : `fr-flex`, `fr-grid-row`, `fr-col-*`, `fr-text--*`, `fr-mb-*`, `fr-mt-*`, etc.
3. **Module CSS** (`.module.css`) — uniquement si les deux options précédentes ne suffisent pas.

**Mobile first :** découper les styles par média en partant du mobile, surcharger pour les écrans larges. Utiliser les breakpoints DSFR (`fr-col-12 fr-col-md-6`).

**Accessibilité :**
- Utiliser les composants DSFR garantit l'accessibilité RGAA de base — ne pas les contourner.
- Tout élément interactif custom doit avoir un `aria-label` ou un label visible.
- Les images doivent avoir un attribut `alt` descriptif (vide `alt=""` si purement décoratif).
- Respecter l'ordre de focus naturel du DOM.
- Ne pas supprimer les styles de focus (`:focus-visible`).

---

## tRPC

**Structure :** `src/server/trpc/routers/<domaine>.ts`

**Procédures disponibles :**
- `baseProcedure` — public
- `protectedProcedure` — authentifié
- `userProcedure` / `ownerProcedure` / `adminProcedure` — par rôle
- `bailleurProcedure(permission)` — permissions granulaires bailleurs

**Input :** toujours validé avec Zod directement dans `.input(z.object({ ... }))`.

**Invalidation côté client :**

```ts
await queryClient.invalidateQueries({ queryKey: trpc.admin.users.list.queryKey() })
```

Utiliser `trpc.<router>.<method>.queryKey()` pour invalider — ne pas écrire de clés manuellement.

**Erreurs :** utiliser `TRPCError` avec les codes standards (`NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST`, `INTERNAL_SERVER_ERROR`).

---

## Drizzle ORM

**WHERE composés :** toujours utiliser `and(eq(...), eq(...))` — `and` est importé depuis `drizzle-orm`.

```ts
import { and, eq } from 'drizzle-orm'

db.select().from(table).where(and(eq(table.ownerId, id), eq(table.status, 'active')))
```

**Schema :** `src/server/db/schema/` — vérifier les noms de colonnes ici avant de les utiliser dans les requêtes.

---

## Services API externes

**Localisation :** `src/server/services/`

**Règles :**
- Valider les réponses avec Zod (`.safeParse()`)
- Utiliser `next: { revalidate: <secondes> }` sur les `fetch` vers des APIs tierces pour bénéficier du cache Next.js
- Lancer une `Error` explicite si la réponse HTTP n'est pas `ok`

```ts
if (!response.ok) throw new Error(`Service X failed: ${response.status}`)
```

---

## Composants React

**Server components par défaut.** N'ajouter `'use client'` que si le composant utilise des hooks React (`useState`, `useEffect`, event handlers).

**Imports :** utiliser l'alias `~/` — ne pas utiliser de chemins relatifs profonds.

```ts
// ✓
import { sanitizeHTML } from '~/utils/sanitize-html'

// ✗
import { sanitizeHTML } from '../../../utils/sanitize-html'
```

---

## Tests

**Deux types :**
- `*.test.ts` — tests unitaires, rapides, sans base de données
- `*.integration.test.ts` — tests avec vraie base de données PostgreSQL

**Fixtures :** utiliser les factories dans `src/__tests__/helpers/` (`createAccommodation`, `createOwner`, etc.)

**Variables d'env de test :** déclarées dans les blocs `env` de `vitest.config.ts`. Toute nouvelle variable d'env doit y être ajoutée (valeur factice suffisante).

---

## Commits

Convention : `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`

```
feat: add Crisp FAQ articles pagination
fix: sanitize HTML from external API response
chore: update env vars for Crisp helpdesk
```

---

## Changelog

Quand une évolution est **perceptible par un humain** (nouvelle fonctionnalité, changement de comportement, correctif qu'un utilisateur a pu subir), ajouter une entrée dans `changelog/`. Elle apparaît dans l'espace d'administration (`/administration/changelog`).

**Ne PAS créer d'entrée** pour : refactor, test, chore, renommage interne, bump de dépendance, ou tout changement invisible.

**Format :** un fichier `changelog/AAAA-MM-JJ-slug.md` par entrée :

```markdown
---
type: nouveaute
perimetre: parcours-contact
date: 2026-10-04
---
# Titre court
Description en 1-3 phrases, en français, orientée bénéfice utilisateur (pas d'implémentation technique).
```

**Valeurs autorisées :**
- `type` (obligatoire) : `nouveaute` · `amelioration` · `correctif` · `technique` (migrations, infra, gros refactors structurants)
- `perimetre` (optionnel) : `recherche-logement` · `simulateurs` · `alertes-logement` · `candidatures` · `parcours-contact` · `comptes-acces` · `admin-interne` · `autre`
- `date` (obligatoire) : date de mise en production, au format `AAAA-MM-JJ`

**Rédaction :** ton produit, pas de jargon. Si l'intention produit (le « pourquoi ça compte ») n'est pas évidente depuis le code, **demander à l'utilisateur** avant d'écrire — ne pas inventer.
