import { describe, expect, it } from 'vitest'
import { maskEmail } from './mask-email'

describe('maskEmail', () => {
  it("ne garde que l'initiale et le domaine", () => {
    expect(maskEmail('jean.dupont@univ.fr')).toBe('j***@univ.fr')
  })

  it("masque entièrement une valeur qui n'est pas une adresse", () => {
    expect(maskEmail('jean.dupont')).toBe('***')
    expect(maskEmail('@univ.fr')).toBe('***')
  })

  it("signale l'absence d'adresse", () => {
    expect(maskEmail(null)).toBe('(sans e-mail)')
    expect(maskEmail('')).toBe('(sans e-mail)')
  })
})
