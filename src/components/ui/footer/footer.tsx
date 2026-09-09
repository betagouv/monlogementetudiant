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
    .sort((a, b) => b.nbTotalApartments - a.nbTotalApartments)
    .map((city) => ({
      ...city,
      expandedBbox: expandBbox(city.bbox.xmin, city.bbox.ymin, city.bbox.xmax, city.bbox.ymax),
    }))

  const ITEMS_PER_COLUMN = 8
  const linkList = [
    {
      links: sortedPopularCities.slice(0, ITEMS_PER_COLUMN).map((city) => ({
        linkProps: {
          href: `/trouver-un-logement-etudiant/ville/${city.slug}?vue=carte&bbox=${city.expandedBbox.west},${city.expandedBbox.south},${city.expandedBbox.east},${city.expandedBbox.north}`,
        },
        text: t('footer.cityLink', { city: city.name }),
      })),
    },
    {
      links: sortedPopularCities.slice(ITEMS_PER_COLUMN, ITEMS_PER_COLUMN * 2).map((city) => ({
        linkProps: {
          href: `/trouver-un-logement-etudiant/ville/${city.slug}?vue=carte&bbox=${city.expandedBbox.west},${city.expandedBbox.south},${city.expandedBbox.east},${city.expandedBbox.north}`,
        },
        text: t('footer.cityLink', { city: city.name }),
      })),
    },
    {
      links: sortedPopularCities.slice(ITEMS_PER_COLUMN * 2, ITEMS_PER_COLUMN * 3).map((city) => ({
        linkProps: {
          href: `/trouver-un-logement-etudiant/ville/${city.slug}?vue=carte&bbox=${city.expandedBbox.west},${city.expandedBbox.south},${city.expandedBbox.east},${city.expandedBbox.north}`,
        },
        text: t('footer.cityLink', { city: city.name }),
      })),
    },
    {
      links: sortedPopularCities.slice(ITEMS_PER_COLUMN * 3).map((city) => ({
        linkProps: {
          href: `/trouver-un-logement-etudiant/ville/${city.slug}?vue=carte&bbox=${city.expandedBbox.west},${city.expandedBbox.south},${city.expandedBbox.east},${city.expandedBbox.north}`,
        },
        text: t('footer.cityLink', { city: city.name }),
      })),
    },
  ]

  // Pas d'attribut title dupliquant l'intitulé du lien (RGAA 6.1) ; il n'est conservé que
  // pour signaler l'ouverture d'une nouvelle fenêtre (RGAA 13.2), que le DSFR applique
  // automatiquement aux liens externes.
  const bottomItems: FooterProps['bottomItems'] = [
    {
      linkProps: { href: '/politique-de-confidentialite' },
      text: t('footer.bottom.privacy'),
    },
    {
      linkProps: { href: '/budget' },
      text: t('footer.bottom.budget'),
    },
    {
      linkProps: { href: 'https://info.monlogementetudiant.beta.gouv.fr/kit-de-communication/' },
      text: t('footer.bottom.communicationKit'),
    },
    {
      linkProps: {
        href: 'https://info.monlogementetudiant.beta.gouv.fr/conditions-generales-dutilisation/',
        title: t('accessibility.linkNewWindow', { label: t('footer.bottom.terms') }),
      },
      text: t('footer.bottom.terms'),
    },
  ]

  const linkListTitle = (
    <span className="fr-text--bold fr-text--xs fr-m-0" style={{ paddingBottom: '12px', display: 'inline-block', fontSize: '12px' }}>
      {t('footer.linkList.citiesCategoryName')}
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
          <span style={{ fontWeight: 'bold' }}>{t('footer.brand')}</span>
          <br />
          {t('header.description')}
        </>
      }
      bottomItems={bottomItems}
      termsLinkProps={{
        href: 'https://info.monlogementetudiant.beta.gouv.fr/mentions-legales/',
        target: '_blank',
        rel: 'noopener noreferrer',
        title: t('accessibility.linkNewWindow', { label: t('footer.legalNotice') }),
      }}
      websiteMapLinkProps={{
        href: '/plan-du-site',
      }}
    />
  )
}
