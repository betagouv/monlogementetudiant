import { describe, expect, it } from 'vitest'
import { applyFrenchContraction, formatCityWithPreposition } from './french-contraction'

describe('applyFrenchContraction', () => {
  it('contracte « à » et « de » devant « Le »', () => {
    expect(applyFrenchContraction('à', 'Le Havre')).toBe('au Havre')
    expect(applyFrenchContraction('de', 'Le Havre')).toBe('du Havre')
  })

  it('contracte « à » et « de » devant « Les »', () => {
    expect(applyFrenchContraction('à', 'Les Sables-d’Olonne')).toBe('aux Sables-d’Olonne')
    expect(applyFrenchContraction('de', 'Les Sables-d’Olonne')).toBe('des Sables-d’Olonne')
  })

  it('ne contracte pas devant « La » ni « L’ »', () => {
    expect(applyFrenchContraction('à', 'La Rochelle')).toBe('à La Rochelle')
    expect(applyFrenchContraction('de', "L'Isle-d'Abeau")).toBe("de L'Isle-d'Abeau")
  })

  it('ne confond pas un nom commençant par « Le » sans espace', () => {
    expect(applyFrenchContraction('à', 'Lens')).toBe('à Lens')
  })

  it('renvoie une chaîne vide pour un nom vide', () => {
    expect(applyFrenchContraction('à', '')).toBe('')
  })
})

describe('formatCityWithPreposition', () => {
  it('applique la contraction française en fr', () => {
    expect(formatCityWithPreposition('fr', 'à', 'Paris')).toBe('à Paris')
    expect(formatCityWithPreposition('fr', 'à', 'Le Havre')).toBe('au Havre')
    expect(formatCityWithPreposition('fr', 'de', 'Les Ulis')).toBe('des Ulis')
  })

  it('traduit « à » par « in » en anglais, sans contraction', () => {
    expect(formatCityWithPreposition('en', 'à', 'Paris')).toBe('in Paris')
    expect(formatCityWithPreposition('en', 'à', ' Le Havre ')).toBe('in Le Havre')
  })

  it('renvoie le nom seul pour « de » en anglais (la préposition est portée par le message)', () => {
    expect(formatCityWithPreposition('en', 'de', 'Le Havre')).toBe('Le Havre')
  })

  it('renvoie une chaîne vide pour un nom vide', () => {
    expect(formatCityWithPreposition('en', 'à', '')).toBe('')
    expect(formatCityWithPreposition('fr', 'de', '')).toBe('')
  })
})
