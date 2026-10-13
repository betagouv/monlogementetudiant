/** Types de changement d'une entrée de changelog (cf. CLAUDE.md § Changelog). */
export const CHANGELOG_TYPES = ['nouveaute', 'amelioration', 'correctif', 'technique'] as const
export type ChangelogType = (typeof CHANGELOG_TYPES)[number]

export const CHANGELOG_TYPE_LABELS: Record<ChangelogType, string> = {
  nouveaute: 'Nouveauté',
  amelioration: 'Amélioration',
  correctif: 'Correctif',
  technique: 'Technique',
}

/** Sévérité DSFR du badge associé à chaque type. */
export const CHANGELOG_TYPE_SEVERITY: Record<ChangelogType, 'success' | 'info' | 'warning' | 'new'> = {
  nouveaute: 'success',
  amelioration: 'info',
  correctif: 'warning',
  // `technique` : migrations, infra, gros refactors structurants (jalons internes).
  technique: 'new',
}

/** Périmètre produit concerné par une entrée (optionnel). */
export const CHANGELOG_PERIMETERS = [
  'recherche-logement',
  'simulateurs',
  'alertes-logement',
  'candidatures',
  'parcours-contact',
  'comptes-acces',
  'admin-interne',
  'autre',
] as const
export type ChangelogPerimeter = (typeof CHANGELOG_PERIMETERS)[number]

export const CHANGELOG_PERIMETER_LABELS: Record<ChangelogPerimeter, string> = {
  'recherche-logement': 'Recherche & carte',
  simulateurs: 'Simulateurs & budget',
  'alertes-logement': 'Alertes logement',
  candidatures: 'Candidatures',
  'parcours-contact': 'Parcours contact',
  'comptes-acces': 'Comptes & accès',
  'admin-interne': 'Admin / interne',
  autre: 'Autre',
}
