import Footer, { type FooterProps } from '@codegouvfr/react-dsfr/Footer'
import { getTranslations } from 'next-intl/server'
import { expandBbox } from '~/components/map/map-utils'
import { BrandTop } from '~/components/ui/brand-top'
import { getPopularCities } from '~/server/territories/get-popular-cities'
import styles from './footer.module.css'

export const CommonFooter = async () => {
  const t = await getTranslations()
  const popularCities = await getPopularCities()
  const sortedPopularCities = popularCities
    .sort((a, b) => b.nb_total_apartments - a.nb_total_apartments)
    .map((city) => ({
      ...city,
      expandedBbox: expandBbox(city.bbox.xmin, city.bbox.ymin, city.bbox.xmax, city.bbox.ymax),
    }))

  const ITEMS_PER_COLUMN = 8
  const linkList = [
    {
      links: sortedPopularCities.slice(0, ITEMS_PER_COLUMN).map((city) => ({
        linkProps: {
          href: `/trouver-un-logement-etudiant/ville/${city.name}?vue=carte&bbox=${city.expandedBbox.west},${city.expandedBbox.south},${city.expandedBbox.east},${city.expandedBbox.north}`,
        },
        text: `Logements étudiants ${city.name}`,
      })),
    },
    {
      links: sortedPopularCities.slice(ITEMS_PER_COLUMN, ITEMS_PER_COLUMN * 2).map((city) => ({
        linkProps: {
          href: `/trouver-un-logement-etudiant/ville/${city.name}?vue=carte&bbox=${city.expandedBbox.west},${city.expandedBbox.south},${city.expandedBbox.east},${city.expandedBbox.north}`,
        },
        text: `Logements étudiants ${city.name}`,
      })),
    },
    {
      links: sortedPopularCities.slice(ITEMS_PER_COLUMN * 2, ITEMS_PER_COLUMN * 3).map((city) => ({
        linkProps: {
          href: `/trouver-un-logement-etudiant/ville/${city.name}?vue=carte&bbox=${city.expandedBbox.west},${city.expandedBbox.south},${city.expandedBbox.east},${city.expandedBbox.north}`,
        },
        text: `Logements étudiants ${city.name}`,
      })),
    },
    {
      links: sortedPopularCities.slice(ITEMS_PER_COLUMN * 3).map((city) => ({
        linkProps: {
          href: `/trouver-un-logement-etudiant/ville/${city.name}?vue=carte&bbox=${city.expandedBbox.west},${city.expandedBbox.south},${city.expandedBbox.east},${city.expandedBbox.north}`,
        },
        text: `Logements étudiants ${city.name}`,
      })),
    },
  ]

  const bottomItems: FooterProps['bottomItems'] = [
    {
      linkProps: {
        href: '/politique-de-confidentialite',
        title: 'Politique de confidentialité',
      },
      text: 'Politique de confidentialité',
    },
    {
      linkProps: {
        href: '/budget',
        title: 'Budget Mon Logement Étudiant',
      },
      text: 'Budget Mon Logement Étudiant',
    },
    {
      linkProps: {
        href: '/simuler-budget',
        title: 'Calculatrice de budget étudiant',
      },
      text: 'Calculatrice de budget étudiant',
    },
    {
      linkProps: {
        href: 'https://info.monlogementetudiant.beta.gouv.fr/conditions-generales-dutilisation/',
        title: "Conditions générales d'utilisation",
      },
      text: "Conditions générales d'utilisation",
    },
  ]

  const linkListTitle = (
    <span className="fr-text--bold fr-text--xs fr-m-0" style={{ paddingBottom: '12px', display: 'inline-block', fontSize: '12px' }}>
      Villes étudiantes
    </span>
  )
  return (
    <Footer
      classes={{
        logo: styles.logo,
        root: styles.footer,
      }}
      brandTop={<BrandTop />}
      accessibility="non compliant"
      linkListTitle={linkListTitle}
      linkList={linkList as NonNullable<FooterProps['linkList']>}
      homeLinkProps={{
        href: '/',
        title: t('metadata.home.title'),
      }}
      contentDescription={
        <>
          <span style={{ fontWeight: 'bold' }}>Mon Logement Étudiant</span>
          <br />
          {t('header.description')}
        </>
      }
      bottomItems={bottomItems}
      termsLinkProps={{
        href: 'https://info.monlogementetudiant.beta.gouv.fr/mentions-legales/',
        target: '_blank',
        rel: 'noopener noreferrer',
      }}
      websiteMapLinkProps={{
        href: '/plan-du-site',
      }}
    />
  )
}
