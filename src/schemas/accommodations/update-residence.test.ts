import { describe, expect, it } from 'vitest'
import { ZUpdateResidence } from './update-residence'

describe('ZUpdateResidence — logements accessibles et en colocation', () => {
  it.each(['nbAccessibleApartments', 'nbColivingApartments'] as const)('accepte %s non renseigné (null)', (field) => {
    expect(ZUpdateResidence.safeParse({ [field]: null }).success).toBe(true)
  })

  it.each([
    ['nbAccessibleApartments', 'Le nombre de logements accessibles doit être un entier positif'],
    ['nbColivingApartments', 'Le nombre de logements en colocation doit être un entier positif'],
  ] as const)('rejette une valeur négative ou décimale pour %s avec un message', (field, message) => {
    for (const value of [-1, 1.5]) {
      const result = ZUpdateResidence.safeParse({ [field]: value })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(message)
    }
  })
})
