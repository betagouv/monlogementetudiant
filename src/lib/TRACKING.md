# Tracking Matomo — Mon Logement Etudiant

## Vue d'ensemble

L'application utilise [Matomo](https://matomo.org/) via `@socialgouv/matomo-next` pour le tracking analytics. Le tracking est **uniquement actif en production** (`NEXT_PUBLIC_APP_ENV=production`).

### Setup

- **Page views automatiques** : Geres par `src/app/matomo.tsx` (layout principal) et `src/components/widget/widget-matomo.tsx` (layout widget)
- **HeartBeat Timer** : Active pour mesurer le temps reel passe sur les pages
- **Cookies** : Desactives (`disableCookies: true`)

## Utilisation

### `trackEvent` — Evenements custom

```ts
import { trackEvent } from '~/lib/tracking'

trackEvent({
  category: 'Recherche',
  action: 'recherche logement',
  name: 'paris',        // optionnel
  value: 500,           // optionnel, numerique
})
```

### `useTracking` — Hook React

```ts
import { useTracking } from '~/hooks/use-tracking'

const { trackEvent } = useTracking()
trackEvent({ category: 'Favoris', action: 'ajout favori', name: 'slug' })
```

## Convention de nommage

| Champ | Convention | Exemple |
|-------|-----------|---------|
| **Category** | Nom francais, Title Case | `Authentification` |
| **Action** | Verbe francais, lowercase | `connexion etudiant` |
| **Name** | Identifiant contextuel | `paris`, `succes`, `erreur` |
| **Value** | Donnee numerique | `500` (prix) |

### Categories disponibles

```ts
type MatomoEventCategory =
  | 'Authentification'
  | 'Recherche'
  | 'Logement'
  | 'Favoris'
  | 'Alertes'
  | 'Widget'
  | 'Simulateur'
  | 'Espace Etudiant'
  | 'Espace Gestionnaire'
  | 'Navigation'
  | 'Engagement'
```

## Catalogue complet des evenements

### Authentification

| ID | Action | Name | Fichier |
|----|--------|------|---------|
| A1 | `connexion etudiant` | `succes` / `erreur` | `credentials-sign-in.tsx` |
| A2 | `connexion gestionnaire` | `succes` / `erreur` | `magic-link-sign-in.tsx` |
| A3 | `inscription` | `succes` / `erreur` | `sign-up-form.tsx` |
| A4 | `deconnexion` | — | `auth-client.ts` |
| A5 | `mot de passe oublie` | `soumis` | `forgot-password-form.tsx` |
| A6 | `reinitialisation mot de passe` | `succes` / `erreur` | `reset-password-form.tsx` |

### Recherche

| ID | Action | Name | Value | Fichier |
|----|--------|------|-------|---------|
| R1 | `recherche logement` | Ville | `find-accommodation-form.tsx` |
| R2 | `filtre prix` | — | Montant | `find-student-accommodation-price.tsx` |
| R3 | `filtre colocation` | `active` / `inactive` | — | `find-student-coliving-accomodation.tsx` |
| R4 | `filtre accessible` | `active` / `inactive` | — | `find-student-accessible-accomodation-switch.tsx` |
| R5 | `filtre crous` | `active` / `inactive` | — | `find-student-accommodation-crous-filter.tsx` |
| R6 | `changement vue` | `grille` / `carte` | — | `find-student-accomodation-sort-view.tsx` |
| R7 | `pagination` | — | N page | `find-student-accomodation-results.tsx` |
| R8 | `recherche ville` | Ville selectionnee | — | `find-student-accommodations-cities-autocomplete-input.tsx` |

### Logement

| ID | Action | Name | Fichier |
|----|--------|------|---------|
| L1 | `clic carte logement` | Slug | `find-student-accomodation-card.tsx` |
| L2 | `consulter offre` | Slug | `consult-offer-button.tsx` |
| L3 | `partage copie lien` | — | `owner-details-actions.tsx` |
| L4 | `partage email` | — | `owner-details-actions.tsx` |
| L5 | `partage impression` | — | `owner-details-actions.tsx` |

### Favoris

| ID | Action | Name | Fichier |
|----|--------|------|---------|
| F1 | `ajout favori` | Slug | `save-accommodation-favorite-button.tsx` |
| F2 | `suppression favori` | Slug | `save-accommodation-favorite-button.tsx` |

### Alertes

| ID | Action | Name | Value | Fichier |
|----|--------|------|-------|---------|
| AL1 | `creation alerte` | Nom | Prix max | `create-student-alert.tsx` |
| AL2 | `modification alerte` | ID alerte | Prix max | `update-student-alert.tsx` |
| AL3 | `suppression alerte` | ID alerte | — | `delete-student-alert.tsx` |
| AL4 | `inscription newsletter` | Territoire | — | `alert-accommodation-form.tsx` |
| AL5 | `inscription alerte logement` | Ville | — | `owner-details-alert.tsx` |

### Widget

| ID | Action | Name | Fichier | Status |
|----|--------|------|---------|--------|
| W1 | `chargement widget` | Domaine referrer | `widget-accommodation-grid.tsx` 
| W2 | `filtre widget` | Type filtre | `widget-accommodation-filters.tsx` | A faire (les filtres sont partages avec le site principal, tracking via R2-R5) |
| W3 | `clic logement widget` | Slug | via `find-student-accomodation-card.tsx` (L1) | Fait (via L1 partage) |
| W4 | `pagination widget` | N page | `widget-accommodation-grid.tsx` 
| W5 | `clic vers site principal` | URL | `widget-accommodation-grid.tsx` 

### Simulateurs

| ID | Action | Name | Value | Fichier | Status |
|----|--------|------|-------|---------|--------|
| S1 | `demarrage simulateur budget` | — | — | `budget-simulator-context.tsx` 
| S2 | `completion simulateur budget` | `excedent` / `deficit` | Montant | `budget-summary.tsx` 
| S3 | `demarrage simulateur aides` | — | — | `help-simulator-form.tsx` 
| S4 | `etape simulateur aides` | N etape | — | `help-simulator-form.tsx` 
| S5 | `completion simulateur aides` | — | — | `help-simulator-form.tsx` 
| S6 | `redemarrage simulateur aides` | — | — | `help-simulator-form.tsx` 
| S7 | `estimation loyer` | Ville | Loyer estime | `rent-search-modal.tsx` 

### Espace Etudiant

| ID | Action | Name | Fichier | Status |
|----|--------|------|---------|--------|
| E1 | `todo fait` | ID todo | `student-todo-list.tsx` 

### Espace Gestionnaire

| ID | Action | Name | Value | Fichier |
|----|--------|------|-------|---------|
| G1 | `creation residence` | Nom | — | `create-residence-form.tsx`
| G2 | `mise a jour residence` | Slug | — | `update-residence-form.tsx`
| G3 | `upload images` | Slug | Nb images | `use-upload-residence-images.ts`
| G4 | `publication residence` / `depublication residence` | Slug | — | `update-residence-publication.tsx`
| G5 | `contacter equipe` | `email` | — | `contact-team-button.tsx`
| G6 | `reservation calendly` | — | — | `calendly-link.tsx`
| G7 | `connexion` | — | Email utilisateur | `track-effective-connection.tsx`

### Navigation

| ID | Action | Name | Fichier | Status |
|----|--------|------|---------|--------|
| N2 | `clic banner enquete` | URL Tally | `banner.tsx` 
| N3 | `fermeture banner` | — | `banner.tsx` 

### Engagement

| ID | Action | Implementation |
|----|--------|---------------|
| EN2 | `temps sur page` | HeartBeat Timer Matomo (`matomo.tsx`) 

## Widget

| Index | Nom | Valeur | Scope | Utilisation |
|-------|-----|--------|-------|-------------|
| 1 | `widget_referrer` | Hostname du site embedant | `visit` | Attribution des conversions widget 
