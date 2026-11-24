import { describe, expect, it } from 'vitest'
import { shouldShowWaitingListBadge } from '~/components/shared/waiting-list-badge'

describe('shouldShowWaitingListBadge', () => {
  it('affiche la liste d’attente seulement sans logement disponible connu', () => {
    expect(shouldShowWaitingListBadge(true, 0)).toBe(true)
    expect(shouldShowWaitingListBadge(true, null)).toBe(true)
    expect(shouldShowWaitingListBadge(true, 3)).toBe(false)
    expect(shouldShowWaitingListBadge(false, 0)).toBe(false)
  })
})
