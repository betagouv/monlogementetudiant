import { describe, expect, it } from 'vitest'
import { normalizeAccommodationName } from './normalize-accommodation-name'

describe('normalizeAccommodationName', () => {
  describe('inputs vides ou absents', () => {
    it('renvoie une chaîne vide pour null', () => {
      expect(normalizeAccommodationName(null)).toBe('')
    })

    it('renvoie une chaîne vide pour undefined', () => {
      expect(normalizeAccommodationName(undefined)).toBe('')
    })

    it('renvoie une chaîne vide pour une chaîne vide', () => {
      expect(normalizeAccommodationName('')).toBe('')
    })

    it('renvoie une chaîne vide pour une chaîne d’espaces', () => {
      expect(normalizeAccommodationName('   ')).toBe('')
    })
  })

  describe('noms sans préfixe Résidence', () => {
    it('title-case un nom en casse mixte', () => {
      expect(normalizeAccommodationName('Le Château')).toBe('le Château')
    })

    it('title-case un nom en minuscules', () => {
      expect(normalizeAccommodationName('la villa bleue')).toBe('la Villa Bleue')
    })

    it('n’est pas déclenché par un mot contenant « residence » sans espace', () => {
      expect(normalizeAccommodationName('Residencia Del Mar')).toBe('Residencia Del Mar')
    })

    it('title-case un nom mixant majuscules et minuscules', () => {
      expect(normalizeAccommodationName('MAISON bleue')).toBe('Maison Bleue')
    })

    it('title-case un mot unique tout en majuscules', () => {
      expect(normalizeAccommodationName('BEAULIEU')).toBe('Beaulieu')
    })

    it('title-case un nom composé tout en majuscules', () => {
      expect(normalizeAccommodationName('MAISON BLEUE')).toBe('Maison Bleue')
    })

    it('met en minuscule les mots-outils dans un nom tout en majuscules', () => {
      expect(normalizeAccommodationName('LA MAISON SUR LA COLLINE')).toBe('la Maison sur la Colline')
    })

    it('gère les élisions L’ dans un nom tout en majuscules', () => {
      expect(normalizeAccommodationName("L'ORANGERIE")).toBe("l'Orangerie")
    })

    it('gère les traits d’union', () => {
      expect(normalizeAccommodationName('BEL-AIR')).toBe('Bel-Air')
    })

    it('trim avant normalisation', () => {
      expect(normalizeAccommodationName('  BEAULIEU  ')).toBe('Beaulieu')
    })

    it('gère les accents', () => {
      expect(normalizeAccommodationName('ÉVÊCHÉ')).toBe('Évêché')
    })

    it('renvoie une chaîne numérique inchangée (pas de lettres)', () => {
      expect(normalizeAccommodationName('12345')).toBe('12345')
    })
  })

  describe('suppression du préfixe Résidence quand il n’y a pas d’article', () => {
    it('retire « RESIDENCE » devant un nom propre', () => {
      expect(normalizeAccommodationName('RESIDENCE BEAULIEU')).toBe('Beaulieu')
    })

    it('retire « Résidence » devant un nom propre déjà capitalisé', () => {
      expect(normalizeAccommodationName('Résidence Beaulieu')).toBe('Beaulieu')
    })

    it('retire « Residences » (pluriel) devant un nom propre', () => {
      expect(normalizeAccommodationName('Residences Montana')).toBe('Montana')
    })

    it('retire « Résidence » devant un nom composé tout en majuscules', () => {
      expect(normalizeAccommodationName('RÉSIDENCE BEL AIR')).toBe('Bel Air')
    })
  })

  describe('conservation du préfixe Résidence avec un article', () => {
    it('garde « Résidence » devant « le »', () => {
      expect(normalizeAccommodationName('RESIDENCE LE PARC')).toBe('Résidence le Parc')
    })

    it('garde « Résidence » devant « la »', () => {
      expect(normalizeAccommodationName('RESIDENCE LA FORET')).toBe('Résidence la Foret')
    })

    it('garde « Résidence » devant « les »', () => {
      expect(normalizeAccommodationName('RESIDENCE LES TILLEULS')).toBe('Résidence les Tilleuls')
    })

    it('garde « Résidence » devant « du »', () => {
      expect(normalizeAccommodationName('RESIDENCE DU PARC')).toBe('Résidence du Parc')
    })

    it('garde « Résidence » devant « de »', () => {
      expect(normalizeAccommodationName('RESIDENCE DE LA MER')).toBe('Résidence de la Mer')
    })

    it('garde « Résidence » devant « des »', () => {
      expect(normalizeAccommodationName('RESIDENCE DES PINS')).toBe('Résidence des Pins')
    })

    it('garde « Résidence » devant « en »', () => {
      expect(normalizeAccommodationName('RESIDENCE EN PROVENCE')).toBe('Résidence en Provence')
    })

    it('garde « Résidence » devant « aux » (en milieu de nom, lowercased)', () => {
      expect(normalizeAccommodationName('RESIDENCE DES FLEURS AUX CHAMPS')).toBe('Résidence des Fleurs aux Champs')
    })
  })

  describe('mots-outils en milieu de nom', () => {
    it('met en minuscule « sur » et « la »', () => {
      expect(normalizeAccommodationName('RESIDENCE DE LA MAISON SUR LA COLLINE')).toBe('Résidence de la Maison sur la Colline')
    })

    it('met en minuscule « et »', () => {
      expect(normalizeAccommodationName('RESIDENCE DU SOLEIL ET DE LA LUNE')).toBe('Résidence du Soleil et de la Lune')
    })

    it('met en minuscule « pour »', () => {
      expect(normalizeAccommodationName('RESIDENCE POUR TOUS')).toBe('pour Tous')
    })

    it('met en minuscule tous les mots-outils présents', () => {
      expect(normalizeAccommodationName('RESIDENCE LES JARDINS DES FLEURS DU PARC EN VILLE')).toBe(
        'Résidence les Jardins des Fleurs du Parc en Ville',
      )
    })
  })

  describe('élisions L’ et D’', () => {
    it('met en minuscule L’ au début du corps (apostrophe droite)', () => {
      expect(normalizeAccommodationName("RESIDENCE L'ORANGERIE")).toBe("l'Orangerie")
    })

    it('met en minuscule D’ au début du corps (apostrophe droite)', () => {
      expect(normalizeAccommodationName("RESIDENCE D'AZUR")).toBe("d'Azur")
    })

    it('gère l’apostrophe typographique', () => {
      expect(normalizeAccommodationName('RESIDENCE L’ORANGERIE')).toBe('l’Orangerie')
    })

    it('met en minuscule une élision en milieu de nom', () => {
      expect(normalizeAccommodationName("RESIDENCE DE L'ORANGERIE")).toBe("Résidence de l'Orangerie")
    })

    it('met en minuscule une élision D’ en milieu de nom', () => {
      expect(normalizeAccommodationName("RESIDENCE DE LA COTE D'AZUR")).toBe("Résidence de la Cote d'Azur")
    })
  })

  describe('title case (initcap)', () => {
    it('capitalise la première lettre de chaque mot', () => {
      expect(normalizeAccommodationName('residence bel air plage')).toBe('Bel Air Plage')
    })

    it('gère les accents dans les mots', () => {
      expect(normalizeAccommodationName('RESIDENCE DE L’ÉVÊCHÉ')).toBe('Résidence de l’Évêché')
    })

    it('capitalise après un trait d’union', () => {
      expect(normalizeAccommodationName('RESIDENCE BEL-AIR')).toBe('Bel-Air')
    })

    it('conserve et capitalise les chiffres et lettres dans un mot alphanumérique', () => {
      expect(normalizeAccommodationName('RESIDENCE BATIMENT A1')).toBe('Batiment A1')
    })
  })

  describe('normalisation des espaces', () => {
    it('compacte les espaces multiples dans le corps', () => {
      expect(normalizeAccommodationName('RESIDENCE   DU    PARC')).toBe('Résidence du Parc')
    })

    it('accepte plusieurs espaces entre « Résidence » et le corps', () => {
      expect(normalizeAccommodationName('Résidence    des Pins')).toBe('Résidence des Pins')
    })

    it('trim les espaces en bord', () => {
      expect(normalizeAccommodationName('   RESIDENCE DES PINS   ')).toBe('Résidence des Pins')
    })
  })

  describe('variantes du préfixe Résidence', () => {
    it('accepte « residence » sans accent, minuscules', () => {
      expect(normalizeAccommodationName('residence du parc')).toBe('Résidence du Parc')
    })

    it('accepte « RESIDENCES » (pluriel, sans accent, majuscules)', () => {
      expect(normalizeAccommodationName('RESIDENCES LES TILLEULS')).toBe('Résidence les Tilleuls')
    })

    it('accepte « Résidences » (pluriel, avec accent)', () => {
      expect(normalizeAccommodationName('Résidences de la Mer')).toBe('Résidence de la Mer')
    })
  })

  describe('chiffres romains', () => {
    it('préserve les chiffres romains en majuscules', () => {
      expect(normalizeAccommodationName('Ernest II')).toBe('Ernest II')
    })

    it('préserve les chiffres romains en majuscules dans un nom tout en majuscules', () => {
      expect(normalizeAccommodationName('ERNEST II')).toBe('Ernest II')
    })

    it('préserve les chiffres romains en majuscules avec préfixe Résidence', () => {
      expect(normalizeAccommodationName('RESIDENCE NAPOLEON III')).toBe('Napoleon III')
    })

    it('est idempotent sur un nom avec chiffres romains', () => {
      const normalized = normalizeAccommodationName('Ernest II')
      expect(normalizeAccommodationName(normalized)).toBe(normalized)
    })
  })

  describe('idempotence', () => {
    it('est idempotent sur un nom déjà normalisé avec article', () => {
      const normalized = normalizeAccommodationName('RESIDENCE DE LA MER')
      expect(normalizeAccommodationName(normalized)).toBe(normalized)
    })

    it('est idempotent sur un nom déjà normalisé sans article', () => {
      const normalized = normalizeAccommodationName('RESIDENCE BEAULIEU')
      expect(normalizeAccommodationName(normalized)).toBe(normalized)
    })
  })
})
