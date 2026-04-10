export const ACTION_LABELS: Record<string, string> = {
  'accommodation.created': 'Résidence créée',
  'accommodation.updated': 'Résidence modifiée',
  'accommodation.availability_updated': 'Disponibilités mises à jour',
  'accommodation.published': 'Résidence publiée',
  'accommodation.unpublished': 'Résidence dépubliée',
  'owner.created': 'Gestionnaire créé',
}

export const ACTION_ICONS: Record<string, string> = {
  'accommodation.created': 'fr-icon-add-circle-line',
  'accommodation.updated': 'fr-icon-edit-line',
  'accommodation.availability_updated': 'fr-icon-checkbox-circle-line',
  'accommodation.published': 'fr-icon-check-line',
  'accommodation.unpublished': 'fr-icon-close-circle-line',
  'owner.created': 'fr-icon-building-line',
}

export const ACTION_COLORS: Record<string, string> = {
  'accommodation.created': 'var(--background-flat-success)',
  'accommodation.updated': 'var(--background-action-high-blue-france)',
  'accommodation.availability_updated': 'var(--background-flat-info)',
  'accommodation.published': 'var(--background-flat-success)',
  'accommodation.unpublished': 'var(--background-flat-error)',
  'owner.created': 'var(--background-flat-warning)',
}

export const ALL_ACTIONS = Object.keys(ACTION_LABELS)
