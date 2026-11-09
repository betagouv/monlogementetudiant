import { describe, expect, it } from 'vitest'
import { createZStudyInstitution, createZStudyYear, createZWorkStudy } from '~/schemas/student-profile/student-profile'

const ZStudyInstitution = createZStudyInstitution()
const ZStudyYear = createZStudyYear()
const ZWorkStudy = createZWorkStudy()

describe('createZStudyInstitution', () => {
  it("refuse une chaîne vide ou faite d'espaces", () => {
    expect(ZStudyInstitution.safeParse('').success).toBe(false)
    expect(ZStudyInstitution.safeParse('   ').success).toBe(false)
  })

  it('refuse plus de 200 caractères et accepte exactement 200', () => {
    expect(ZStudyInstitution.safeParse('a'.repeat(201)).success).toBe(false)
    expect(ZStudyInstitution.safeParse('a'.repeat(200)).success).toBe(true)
  })

  it('retire les espaces autour', () => {
    expect(ZStudyInstitution.parse('  Université de Lille ')).toBe('Université de Lille')
  })
})

describe('createZStudyYear', () => {
  it('accepte les valeurs connues', () => {
    for (const value of ['bac_1', 'bac_2', 'bac_3', 'bac_4', 'bac_5_plus']) {
      expect(ZStudyYear.safeParse(value).success).toBe(true)
    }
  })

  it('refuse une valeur inconnue avec un message français', () => {
    const result = ZStudyYear.safeParse('bac_6')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("Veuillez sélectionner votre année d'études")
  })
})

describe('createZWorkStudy', () => {
  it('exige un booléen', () => {
    expect(ZWorkStudy.safeParse(false).success).toBe(true)
    expect(ZWorkStudy.safeParse(undefined).success).toBe(false)
  })
})
