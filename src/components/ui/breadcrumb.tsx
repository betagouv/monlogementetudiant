'use client'

import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb'
import { RegisteredLinkProps } from '@codegouvfr/react-dsfr/link'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { FC, ReactNode } from 'react'
import { tss } from 'tss-react'

type DynamicBreadcrumbProps = {
  color?: string
  margin?: boolean
  title?: string
}

export const DynamicBreadcrumb: FC<DynamicBreadcrumbProps> = ({ color, margin = true, title }) => {
  const pathname = usePathname()
  const t = useTranslations()
  const { classes } = useStyles({ color, margin })

  const getCurrentPageDetails = () => {
    let currentPageLabel = t('breadcrumbs.notFound')
    const segments: {
      label: ReactNode
      linkProps: RegisteredLinkProps
    }[] = []

    switch (pathname) {
      case '/simuler-mes-aides-au-logement':
        currentPageLabel = t('breadcrumbs.home')
        break
      case '/accessibilite':
        currentPageLabel = t('breadcrumbs.accessibilite')
        break
      case '/mentions-legales':
        currentPageLabel = t('breadcrumbs.legalMentions')
        break
      case '/politique-de-confidentialite':
        currentPageLabel = t('breadcrumbs.privacyPolicy')
        break
      case '/budget':
        currentPageLabel = t('breadcrumbs.budget')
        break
      case '/donnees-personnelles':
        currentPageLabel = t('breadcrumbs.personalData')
        break
      case '/cookies':
        currentPageLabel = t('breadcrumbs.cookies')
        break
      case '/faq':
        currentPageLabel = t('breadcrumbs.faq')
        break
      case '/plan-du-site':
        currentPageLabel = t('breadcrumbs.sitemap')
        break
      case '/trouver-un-logement-etudiant':
        currentPageLabel = t('breadcrumbs.findAccomodation')
        break
      case pathname.match(/^\/trouver-un-logement-etudiant\/ville\/[^/]+\/[^/]+$/)?.input:
        segments.push({
          label: t('breadcrumbs.findAccomodationWithLocation', { location: title }),
          linkProps: {
            href: '/trouver-un-logement-etudiant',
          },
        })
        currentPageLabel = title as string
        break
      case pathname.match(/^\/trouver-un-logement-etudiant\/[^?]+(?:\?.*)?$/)?.input:
        currentPageLabel = title as string
        break
      case '/preparer-mon-budget-etudiant':
        currentPageLabel = t('breadcrumbs.prepareBudget')
        break
      case '/preparer-sa-vie-etudiante':
        currentPageLabel = t('breadcrumbs.prepareStudentLife')
        break
      case pathname.match(/^\/preparer-sa-vie-etudiante\/[a-zA-Z0-9-]+$/)?.input:
        currentPageLabel = t('breadcrumbs.prepareStudentLifeTitle', { title })
        segments.push({
          label: t('breadcrumbs.prepareStudentLife'),
          linkProps: {
            href: `/preparer-sa-vie-etudiante/`,
          },
        })
        break
    }
    return { currentPageLabel, segments }
  }

  const { currentPageLabel, segments } = getCurrentPageDetails()

  return (
    <div className={classes.breadcrumb}>
      <Breadcrumb
        className={classes.breadcrumb}
        currentPageLabel={currentPageLabel}
        homeLinkProps={{
          href: '/',
        }}
        segments={segments}
      />
    </div>
  )
}
const useStyles = tss.withParams<{ color?: string; margin?: boolean }>().create(({ color, margin }) => ({
  breadcrumb: {
    ...(!margin
      ? {
          '& .fr-breadcrumb': {
            margin: 0,
          },
        }
      : {
          '& .fr-breadcrumb': {
            margin: '1rem 0 1rem',
          },
        }),
    '& .fr-breadcrumb__link': {
      color: color ? `${color} !important` : undefined,
    },
    color: color ?? undefined,
    marginTop: 0,
    paddingTop: '0.5rem',
  },
}))
