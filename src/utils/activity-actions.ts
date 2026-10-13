export const ACTION_LABELS: Record<string, string> = {
  'accommodation.created': 'Résidence créée',
  'accommodation.updated': 'Résidence modifiée',
  'accommodation.availability_updated': 'Disponibilités mises à jour',
  'accommodation.published': 'Résidence publiée',
  'accommodation.unpublished': 'Résidence dépubliée',
  'accommodation.applications_suspended': 'Candidatures suspendues',
  'accommodation.applications_resumed': 'Candidatures reprises',
  'owner.created': 'Gestionnaire créé',
  'owner.contact_mode_updated': 'Mode de candidatures modifié',
  'owner.moderation_managers_updated': 'Droits de modération modifiés',
  'owner.user_application_scope_updated': 'Périmètre des candidatures modifié',
  'owner.application_residences_updated': 'Résidences ouvertes aux candidatures modifiées',
}

export const ACTION_ICONS: Record<string, string> = {
  'accommodation.created': 'fr-icon-add-circle-line',
  'accommodation.updated': 'fr-icon-edit-line',
  'accommodation.availability_updated': 'fr-icon-checkbox-circle-line',
  'accommodation.published': 'fr-icon-check-line',
  'accommodation.unpublished': 'fr-icon-close-circle-line',
  'accommodation.applications_suspended': 'fr-icon-pause-circle-line',
  'accommodation.applications_resumed': 'fr-icon-play-circle-line',
  'owner.created': 'fr-icon-building-line',
  'owner.contact_mode_updated': 'fr-icon-mail-line',
  'owner.moderation_managers_updated': 'fr-icon-team-line',
  'owner.user_application_scope_updated': 'fr-icon-building-line',
  'owner.application_residences_updated': 'fr-icon-building-line',
}

export const ACTION_COLORS: Record<string, string> = {
  'accommodation.created': 'var(--background-flat-success)',
  'accommodation.updated': 'var(--background-action-high-blue-france)',
  'accommodation.availability_updated': 'var(--background-flat-info)',
  'accommodation.published': 'var(--background-flat-success)',
  'accommodation.unpublished': 'var(--background-flat-error)',
  'accommodation.applications_suspended': 'var(--background-flat-warning)',
  'accommodation.applications_resumed': 'var(--background-flat-success)',
  'owner.created': 'var(--background-flat-warning)',
  'owner.contact_mode_updated': 'var(--background-flat-purple-glycine)',
  'owner.moderation_managers_updated': 'var(--background-flat-purple-glycine)',
  'owner.user_application_scope_updated': 'var(--background-flat-blue-ecume)',
  'owner.application_residences_updated': 'var(--background-flat-blue-ecume)',
}

export const ALL_ACTIONS = Object.keys(ACTION_LABELS)
