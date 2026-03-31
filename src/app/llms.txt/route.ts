import { NextResponse } from 'next/server'
import { z } from 'zod'

export async function GET() {
  const baseUrl = z.string().parse(process.env.BASE_URL)

  const content = `# Mon Logement Étudiant

> Plateforme nationale française pour faciliter l'accès au logement des étudiants.

Mon Logement Étudiant est une startup d'État (beta.gouv.fr) du Ministère de l'Enseignement Supérieur. La plateforme centralise les offres de résidences étudiantes conventionnées à travers la France et propose des outils gratuits pour simuler les aides au logement et préparer son budget.

**Mission :** L'accès au logement ne doit jamais être un obstacle à la réussite universitaire.

**Public cible :** Étudiants, notamment boursiers et en situation de précarité.

**Types de logements référencés :** Résidences universitaires CROUS, résidences services étudiantes, logements sociaux jeunes actifs (RSJA, FJT), colocations.

## Fonctionnalités principales

- [Rechercher un logement étudiant](${baseUrl}/trouver-un-logement-etudiant): Moteur de recherche avec filtres par ville, budget, type de logement et accessibilité PMR
- [Simuler mes aides au logement](${baseUrl}/simuler-mes-aides-au-logement): Calculateur d'éligibilité aux aides CAF (APL, ALS, ALF)
- [Préparer mon budget étudiant](${baseUrl}/preparer-mon-budget-etudiant): Simulateur de budget mensuel étudiant
- [Alertes logement](${baseUrl}/alerte-logement): Notifications email pour les nouvelles offres disponibles

## Informations légales

- [Mentions légales](${baseUrl}/mentions-legales)
- [Politique de confidentialité](${baseUrl}/politique-de-confidentialite)
- [Accessibilité](${baseUrl}/accessibilite)

## Optional

- [Plan du site](${baseUrl}/plan-du-site)
- [Sitemap XML](${baseUrl}/sitemap.xml)
`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
