import { TTerritory } from '~/schemas/territories'
import { getCanonicalUrl } from '~/utils/canonical'
import { type BreadcrumbItem, type FaqItem } from '~/utils/schema'

export function getSearchBreadcrumbItems(territory: TTerritory | undefined, routeCategoryKey: string): BreadcrumbItem[] {
  return [
    { name: 'Accueil', item: getCanonicalUrl('/') },
    { name: 'Trouver un logement étudiant', item: getCanonicalUrl('/trouver-un-logement-etudiant') },
    ...(territory && routeCategoryKey
      ? [
          {
            name: territory.name,
            item: getCanonicalUrl(
              `/trouver-un-logement-etudiant/${routeCategoryKey}/${'slug' in territory ? territory.slug : territory.name}`,
            ),
          },
        ]
      : []),
  ]
}

export function getSearchFaqItems(): FaqItem[] {
  return [
    {
      question: 'Quels types de logements sont accessibles aux étudiants ?',
      answer:
        "Plusieurs options s'offrent à vous : Résidences universitaires conventionnées ou à vocation sociale : réservées aux étudiants, elles proposent des loyers encadrés, souvent inférieurs aux prix du marché. L'accès est priorisé pour les étudiants aux revenus modestes (ex. : boursiers du Crous). Résidences services étudiantes : également réservées aux étudiants, mais avec des loyers non encadrés. Location classique : logement indépendant loué auprès d'un particulier ou via une agence. Logement chez l'habitant ou intergénérationnel : chambre louée dans un logement occupé, souvent avec des loyers réduits.",
    },
    {
      question: 'Comment comprendre les typologies de logement (T1, T2, studio, etc.) ?',
      answer:
        "Studio : une seule pièce à vivre avec une pièce d'eau (salle de bain/WC). T1 : une pièce à vivre + une cuisine séparée + salle de bain/WC. T2, T3... : chaque chiffre supplémentaire correspond à une pièce en plus (ex. : un T2 comprend un salon et une chambre).",
    },
    {
      question: 'Que signifie "loyer charges comprises" ?',
      answer:
        "Si une annonce indique \"cc\" (charges comprises), cela signifie que certaines charges sont incluses dans le loyer, comme l'entretien des parties communes, l'eau froide/chaude ou l'électricité. Vérifiez toujours précisément ce que couvrent les charges avant de signer.",
    },
  ]
}
