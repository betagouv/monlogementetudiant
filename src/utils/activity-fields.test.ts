import { describe, expect, it } from 'vitest'
import { formatDiffFieldLabel, formatDiffValue, parseTypologyDiffKey } from './activity-fields'

// Les anciennes entrées de `activity_log` ne seront jamais réécrites : le journal doit continuer à
// savoir lire les noms de colonnes plates d'avant le 21/07/2026, en plus des clés structurées.
// La liste ci-dessous est l'inventaire exhaustif des clés de typologie réellement présentes en base.
const LEGACY_KEYS_EN_BASE = [
  'nbT1',
  'nbT1Available',
  'nbT1Bis',
  'nbT1BisAvailable',
  'nbT2',
  'nbT2Available',
  'nbT3',
  'nbT3Available',
  'nbT4',
  'nbT4Available',
  'nbT5',
  'nbT5Available',
  'nbT6',
  'nbT6Available',
  'nbT7MoreAvailable',
  'priceMaxT1',
  'priceMaxT1Bis',
  'priceMaxT2',
  'priceMaxT3',
  'priceMaxT4',
  'priceMaxT5',
  'priceMaxT6',
  'priceMaxT7More',
  'priceMinT1',
  'priceMinT1Bis',
  'priceMinT2',
  'priceMinT3',
  'priceMinT4',
  'priceMinT5',
  'priceMinT6',
  'priceMinT7More',
  'superficieMaxT1',
  'superficieMaxT1Bis',
  'superficieMaxT2',
  'superficieMaxT3',
  'superficieMaxT4',
  'superficieMaxT5',
  'superficieMaxT6',
  'superficieMaxT7More',
  'superficieMinT1',
  'superficieMinT1Bis',
  'superficieMinT2',
  'superficieMinT3',
  'superficieMinT4',
  'superficieMinT5',
  'superficieMinT6',
  'superficieMinT7More',
]

describe('parseTypologyDiffKey — ancienne convention (colonnes plates)', () => {
  it.each(LEGACY_KEYS_EN_BASE)('reconnaît %s', (key) => {
    expect(parseTypologyDiffKey(key)).not.toBeNull()
  })

  it('distingue T1 de T1 bis', () => {
    expect(parseTypologyDiffKey('nbT1')).toEqual({ typology: 't1', field: 'nbTotal' })
    expect(parseTypologyDiffKey('nbT1Bis')).toEqual({ typology: 't1_bis', field: 'nbTotal' })
    expect(parseTypologyDiffKey('nbT1Available')).toEqual({ typology: 't1', field: 'nbAvailable' })
    expect(parseTypologyDiffKey('nbT1BisAvailable')).toEqual({ typology: 't1_bis', field: 'nbAvailable' })
  })

  it('mappe T7More sur t7_more', () => {
    expect(parseTypologyDiffKey('superficieMinT7More')).toEqual({ typology: 't7_more', field: 'superficieMin' })
  })
})

describe('parseTypologyDiffKey — nouvelle convention', () => {
  it('reconnaît les clés structurées', () => {
    expect(parseTypologyDiffKey('typologies.t1.nbAvailable')).toEqual({ typology: 't1', field: 'nbAvailable' })
    expect(parseTypologyDiffKey('typologies.t7_more.superficieMax')).toEqual({ typology: 't7_more', field: 'superficieMax' })
    expect(parseTypologyDiffKey('typologies.t3.present')).toEqual({ typology: 't3', field: 'present' })
  })

  it('rejette un type ou un champ inconnu', () => {
    expect(parseTypologyDiffKey('typologies.t9.nbTotal')).toBeNull()
    expect(parseTypologyDiffKey('typologies.t1.inventé')).toBeNull()
    expect(parseTypologyDiffKey('typologies.t1')).toBeNull()
  })
})

describe('parseTypologyDiffKey — champs de la résidence', () => {
  // Régression à éviter : ces clés commencent par « nb » sans être des typologies.
  it.each(['nbAccessibleApartments', 'nbColivingApartments', 'name', 'published', 'imagesUrls'])('ne confond pas %s', (key) => {
    expect(parseTypologyDiffKey(key)).toBeNull()
  })
})

describe('formatDiffFieldLabel', () => {
  it('donne le même libellé aux deux conventions', () => {
    expect(formatDiffFieldLabel('nbT1BisAvailable')).toBe('Studio T1 bis · Logements disponibles')
    expect(formatDiffFieldLabel('typologies.t1_bis.nbAvailable')).toBe('Studio T1 bis · Logements disponibles')

    expect(formatDiffFieldLabel('superficieMinT3')).toBe('Logement T3 · Superficie minimum')
    expect(formatDiffFieldLabel('typologies.t3.superficieMin')).toBe('Logement T3 · Superficie minimum')

    expect(formatDiffFieldLabel('priceMaxT7More')).toBe('Logement T7+ · Loyer maximum')
    expect(formatDiffFieldLabel('typologies.t7_more.priceMax')).toBe('Logement T7+ · Loyer maximum')
  })

  it('traduit les champs de la résidence, y compris la clé snake_case héritée', () => {
    expect(formatDiffFieldLabel('nbAccessibleApartments')).toBe('Logements adaptés PMR')
    expect(formatDiffFieldLabel('targetAudience')).toBe('Public visé')
    expect(formatDiffFieldLabel('target_audience')).toBe('Public visé')
  })

  it('retombe sur la clé brute plutôt que de masquer un champ inconnu', () => {
    expect(formatDiffFieldLabel('champInconnu')).toBe('champInconnu')
  })
})

describe('formatDiffValue', () => {
  it('rend les absences, les booléens et les listes', () => {
    expect(formatDiffValue(null)).toBe('—')
    expect(formatDiffValue(undefined)).toBe('—')
    expect(formatDiffValue('')).toBe('—')
    expect(formatDiffValue(true)).toBe('Oui')
    expect(formatDiffValue(false)).toBe('Non')
    expect(formatDiffValue(['a', 'b'])).toBe('2 élément(s)')
  })

  it('conserve 0 au lieu de l’afficher comme une absence', () => {
    expect(formatDiffValue(0)).toBe('0')
  })
})
