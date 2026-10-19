import { describe, expect, it } from 'vitest'
import { descriptionToText, sectionHtmlToText, splitDescription } from './description-sections'

describe('splitDescription', () => {
  it('renvoie des rubriques vides sans description', () => {
    expect(splitDescription(null)).toEqual({
      tagline: null,
      locationAndProximity: null,
      servicesAndEquipment: null,
      receptionAndContact: null,
      practicalInfo: null,
      otherInformation: null,
    })
    expect(splitDescription('  ').tagline).toBeNull()
  })

  it('répartit les phrases d’un paragraphe HTML entre les rubriques', () => {
    const sections = splitDescription(
      '<p>Bienvenue à la <strong>résidence Les Lilas.</strong> Située rue Victor Hugo, elle est à 5 min à pied de la gare. ' +
        'Tu profites d’une laverie et d’un local à vélos.</p>' +
        '<p>Accueil sur rendez-vous du lundi au vendredi de 9h à 17h.</p>' +
        '<p>Logements éligibles à l’APL, dépôt de garantie d’un mois de loyer.</p>',
    )

    expect(sections.tagline).toBe('Bienvenue à la résidence Les Lilas.')
    expect(sections.locationAndProximity).toBe('<p>Située rue Victor Hugo, elle est à 5 min à pied de la gare.</p>')
    expect(sections.servicesAndEquipment).toBe('<p>Tu profites d’une laverie et d’un local à vélos.</p>')
    expect(sections.receptionAndContact).toBe('<p>Accueil sur rendez-vous du lundi au vendredi de 9h à 17h.</p>')
    expect(sections.practicalInfo).toBe('<p>Logements éligibles à l’APL, dépôt de garantie d’un mois de loyer.</p>')
    expect(sections.otherInformation).toBeNull()
  })

  it('structure le texte brut importé : titres, puces et listes sans marqueur', () => {
    const sections = splitDescription(
      [
        'Une résidence au bord de l’eau',
        'Située en bord de Deûle, la résidence offre un cadre calme.',
        '',
        'Transports et accessibilité',
        'La résidence est bien desservie :',
        '>arrêt Molière à 12 minutes à pied,',
        '>station V’Lille à proximité.',
        '',
        'Les logements sont meublés :',
        'o Un lit double',
        'o Un bureau + chaise',
        '',
        'Loyer à partir de 320 € - Charges à partir de 103 €',
      ].join('\n'),
    )

    expect(sections.tagline).toBe('Une résidence au bord de l’eau')
    expect(sections.locationAndProximity).toBe(
      '<p>Située en bord de Deûle, la résidence offre un cadre calme.</p>' +
        '<p><strong>Transports et accessibilité</strong></p>' +
        '<p>La résidence est bien desservie :</p>' +
        '<ul><li>arrêt Molière à 12 minutes à pied,</li><li>station V’Lille à proximité.</li></ul>',
    )
    expect(sections.servicesAndEquipment).toBe(
      '<p>Les logements sont meublés :</p><ul><li>Un lit double</li><li>Un bureau + chaise</li></ul>',
    )
    expect(sections.practicalInfo).toBe('<p>Loyer à partir de 320 € - Charges à partir de 103 €</p>')
  })

  it('décode les entités HTML et range le texte sans signal dans « Autre »', () => {
    const sections = splitDescription('<p>R&eacute;sidence &agrave; deux pas du campus.</p><p>Visite virtuelle 360&deg;</p>')

    expect(sections.locationAndProximity).toBe('<p>Résidence à deux pas du campus.</p>')
    expect(sections.otherInformation).toBe('<p>Visite virtuelle 360°</p>')
  })

  it('ne laisse passer aucun HTML dangereux', () => {
    const sections = splitDescription(
      '<p>Laverie et parking sur place.<script>alert(1)</script><a href="javascript:alert(1)" onclick="x()">wifi</a></p>',
    )

    expect(sections.servicesAndEquipment).not.toMatch(/script|javascript|onclick/)
  })
})

describe('versions texte', () => {
  it('convertit le HTML des rubriques en texte avec puces', () => {
    expect(sectionHtmlToText('<p>Intro :</p><ul><li>Laverie</li><li>Parking &amp; vélos</li></ul>')).toBe(
      'Intro :\n• Laverie\n• Parking & vélos',
    )
  })

  it('aplatit la description d’origine', () => {
    expect(descriptionToText('<p>Studio&nbsp;meublé</p><ul><li>Wifi</li></ul>')).toBe('Studio meublé\n• Wifi')
  })
})
