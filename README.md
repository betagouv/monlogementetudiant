# Mon Logement Etudiant - Client

Plateforme qui aide les etudiants a trouver un logement.

## Stack

- Next.js (App Router)
- React 19
- React-DSFR
- React Query (TanStack)
- nuqs (URL state)
- React Hook Form + Zod
- Leaflet
- tss-react
- Biome

## Installation

```bash
pnpm install
```

## Commandes

```bash
pnpm dev        # Dev local
pnpm build      # Build production
pnpm start      # Start production
pnpm lint       # Lint (Biome)
```

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
  components/
    find-student-accomodation/  # Composants recherche logement (cards, filtres, autocomplete)
    widget/                     # Composants specifiques widget
    map/                        # Carte Leaflet
    ui/                         # Composants generiques (skeleton, footer, header)
    shared/                     # Composants partages (badges)
  hooks/                        # Hooks (useAccomodations, useTerritories, useSearchCities)
  server-only/                  # Fonctions serveur (getAccommodations, getTerritories)
  schemas/                      # Schemas Zod (accommodations, territories)
  providers/                    # Providers React (TanStack Query)
  dsfr/                         # Config DSFR (provider, head, color scheme)
  utils/                        # Utilitaires
public/
  widget/
    embed.js                    # Script d'embed pour les partenaires
    test.html                   # Page de test du widget
```

## Widget iframe

Widget embarquable qui affiche une grille de residences etudiantes sur des sites partenaires.

### Integration

Une seule ligne a fournir au partenaire :

```html
<script src="https://mon-logement-etudiant.gouv.fr/widget/embed.js" data-city="Paris"></script>
```

Le script cree automatiquement l'iframe et gere le redimensionnement dynamique.

### Parametres

| Attribut | Description | Exemple |
|---|---|---|
| `data-city` | Ville (resolue en bbox automatiquement) | `data-city="Paris"` |
| `data-bbox` | Bounding box manuelle (west,south,east,north) | `data-bbox="2.2,48.8,2.5,48.9"` |
| `data-prix` | Budget max en euros | `data-prix="800"` |
| `data-crous` | CROUS uniquement | `data-crous="true"` |
| `data-colocation` | Colocation uniquement | `data-colocation="true"` |
| `data-accessible` | Logements PMR | `data-accessible="true"` |
| `data-filters` | Masquer les filtres | `data-filters="false"` |
| `data-page` | Page de pagination | `data-page="2"` |
| `data-target` | ID de l'element ou deposer l'iframe | `data-target="widget-container"` |

Si `data-city` ou `data-bbox` est fourni, le champ de recherche de localisation est masque.

### Exemples

```html
<!-- Paris, budget max 800€ -->
<script src="https://mon-logement-etudiant.gouv.fr/widget/embed.js" data-city="Paris" data-prix="800"></script>

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
open /tmp/widget-test.html   # ou copier public/widget/test.html en dehors du projet
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
