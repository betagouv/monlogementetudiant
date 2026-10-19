import type { TBailleurAccommodationScope } from '~/schemas/bailleur-users/accommodation-scope'

export type StoredScope = { restricted: false } | { restricted: true; accommodationIds: number[] }

type NextAssignmentInput = {
  scope: StoredScope
  selectedIn: number[]
  removedFrom: number[]
}

type NextAssignment = { applicationsEnabled: boolean; scope: TBailleurAccommodationScope | null }

/**
 * Affectation d'un gestionnaire après l'écran « Paramètres de réception » : `selectedIn` et `removedFrom`
 * partitionnent les résidences cochées. `scope: null` = périmètre inchangé.
 *
 * L'écran fait référence : un périmètre restreint se réduit aux résidences cochées où le gestionnaire est
 * sélectionné. Garder les résidences non cochées les lui rendrait d'office à leur réouverture.
 */
export function nextManagerAssignment({ scope, selectedIn, removedFrom }: NextAssignmentInput): NextAssignment {
  if (selectedIn.length === 0) {
    return { applicationsEnabled: false, scope: null }
  }

  if (!scope.restricted && removedFrom.length === 0) return { applicationsEnabled: true, scope: null }

  const next = [...new Set(selectedIn)].sort((a, b) => a - b)
  if (scope.restricted) {
    const current = [...scope.accommodationIds].sort((a, b) => a - b)
    const unchanged = next.length === current.length && next.every((id, i) => id === current[i])
    if (unchanged) return { applicationsEnabled: true, scope: null }
  }

  return { applicationsEnabled: true, scope: { mode: 'restricted', accommodationIds: next } }
}
