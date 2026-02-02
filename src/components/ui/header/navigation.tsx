'use client'

import MainNavigation, { MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import styles from './navigation.module.css'

const STUDENT_CITIES = [
  { name: 'Aix-en-Provence', slug: 'aix-en-provence' },
  { name: 'Angers', slug: 'angers' },
  { name: 'Bordeaux', slug: 'bordeaux' },
  { name: 'Caen', slug: 'caen' },
  { name: 'Grenoble', slug: 'grenoble' },
  { name: 'Lille', slug: 'lille' },
  { name: 'Lyon', slug: 'lyon' },
  { name: 'Marseille', slug: 'marseille' },
  { name: 'Montpellier', slug: 'montpellier' },
  { name: 'Nanterre', slug: 'nanterre' },
  { name: 'Nantes', slug: 'nantes' },
  { name: 'Paris', slug: 'paris' },
  { name: 'Rennes', slug: 'rennes' },
  { name: 'Toulouse', slug: 'toulouse' },
]

const CITIES_PER_COLUMN = 5

export const HeaderNavigation: FC = () => {
  const t = useTranslations('navigation')
  const pathname = usePathname()

  const cityLinks = STUDENT_CITIES.map((city) => ({
    text: city.name,
    linkProps: {
      href: `/preparer-sa-vie-etudiante/${city.slug}/`,
      target: '_self' as const,
    },
  }))

  const cityColumns = [
    cityLinks.slice(0, CITIES_PER_COLUMN),
    cityLinks.slice(CITIES_PER_COLUMN, CITIES_PER_COLUMN * 2),
    [
      ...cityLinks.slice(CITIES_PER_COLUMN * 2),
      {
        text: <span className="fr-text--bold">{t('prepareBudget.moreCities')}</span>,
        linkProps: {
          href: '/preparer-sa-vie-etudiante/',
          target: '_self' as const,
        },
      },
    ],
  ]

  let items: MainNavigationProps.Item[] = [
    {
      isActive: pathname === '/trouver-un-logement-etudiant',
      linkProps: {
        href: '/trouver-un-logement-etudiant',
        target: '_self',
      },
      text: t('findAccommodation'),
    },
    {
      isActive:
        pathname.startsWith('/preparer-mon-budget') ||
        pathname.startsWith('/simuler-budget') ||
        pathname.startsWith('/preparer-sa-vie-etudiante'),
      text: t('prepareBudget.title'),
      megaMenu: {
        categories: [
          {
            categoryMainText: <span className="fr-text--bold">{t('prepareBudget.anticipate')}</span>,
            links: [
              {
                text: t('prepareBudget.calculator'),
                linkProps: { href: '/simuler-budget', target: '_self' as const },
              },
              {
                text: t('prepareBudget.hints'),
                linkProps: { href: '/preparer-mon-budget-etudiant', target: '_self' as const },
              },
            ],
          },
          {
            categoryMainText: <span className="fr-text--bold"> {t('prepareBudget.studentCities')}</span>,
            links: cityColumns[0],
          },
          {
            categoryMainText: '\u00A0',
            links: cityColumns[1],
          },
          {
            categoryMainText: '\u00A0',
            links: cityColumns[2],
          },
        ],
      },
    },
    {
      isActive: pathname === '/simuler-mes-aides-au-logement',
      linkProps: {
        href: '/simuler-mes-aides-au-logement',
        target: '_self',
      },
      text: t('home'),
    },
  ]
  if (pathname.includes('landing')) {
    items = []
  }
  return <MainNavigation classes={{ megaMenuCategory: styles.megaMenuCategory }} items={items} />
}
