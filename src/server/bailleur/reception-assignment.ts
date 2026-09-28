import type { TBailleurAccommodationScope } from '~/schemas/bailleur-users/accommodation-scope'

export type StoredScope = { restricted: false } | { restricted: true; accommodationIds: number[] }

type NextAssignmentInput = {
  scope: StoredScope
  selectedIn: number[]
  removedFrom: number[]
  ownerAccommodationIds: number[]
}

type NextAssignment = { applicationsEnabled: boolean; scope: TBailleurAccommodationScope | null }

/**
 * Affectation d'un gestionnaire après l'écran « Paramètres de réception » : `selectedIn` et `removedFrom`
 * partitionnent les résidences cochées. `scope: null` = périmètre inchangé.
 */
export function nextManagerAssignment({ scope, selectedIn, removedFrom, ownerAccommodationIds }: NextAssignmentInput): NextAssignment {
  if (selectedIn.length === 0) {
    return { applicationsEnabled: false, scope: null }
  }

  const removed = new Set(removedFrom)

  if (!scope.restricted) {
    if (removed.size === 0) return { applicationsEnabled: true, scope: null }
    return {
      applicationsEnabled: true,
      scope: { mode: 'restricted', accommodationIds: ownerAccommodationIds.filter((id) => !removed.has(id)) },
    }
  }

  const next = [...new Set([...scope.accommodationIds, ...selectedIn])].filter((id) => !removed.has(id)).sort((a, b) => a - b)
  const current = [...scope.accommodationIds].sort((a, b) => a - b)
  const unchanged = next.length === current.length && next.every((id, i) => id === current[i])

  return { applicationsEnabled: true, scope: unchanged ? null : { mode: 'restricted', accommodationIds: next } }
}
