'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { expandBbox } from '~/components/map/map-utils'
import { TAlert } from '~/schemas/alerts/get-alerts'
import { sPluriel } from '~/utils/sPluriel'
import styles from './student-alert-count-button.module.css'

export const StudentAlertCountButton = ({ alert }: { alert: TAlert }) => {
  const t = useTranslations('student.alerts')
  const tA11y = useTranslations('accessibility')
  const getHref = () => {
    const searchParams = new URLSearchParams()

    if (alert.hasColiving) {
      searchParams.set('colocation', 'true')
    }

    if (alert.isAccessible) {
      searchParams.set('accessible', 'true')
    }

    if (alert.maxPrice) {
      searchParams.set('prix', alert.maxPrice.toString())
    }

    if (alert.city) {
      const { bbox } = alert.city
      const expanded = expandBbox(bbox.xmin, bbox.ymin, bbox.xmax, bbox.ymax)
      searchParams.set('bbox', `${expanded.west},${expanded.south},${expanded.east},${expanded.north}`)
      searchParams.set('vue', 'carte')
      return `/trouver-un-logement-etudiant/ville/${alert.city.slug}?${searchParams.toString()}`
    }

    if (alert.academy) {
      searchParams.set('academie', alert.academy.id.toString())
      return `/trouver-un-logement-etudiant/academie/${alert.academy.slug}?${searchParams.toString()}`
    }

    if (alert.department) {
      const { bbox } = alert.department
      const expanded = expandBbox(bbox.xmin, bbox.ymin, bbox.xmax, bbox.ymax)
      searchParams.set('bbox', `${expanded.west},${expanded.south},${expanded.east},${expanded.north}`)
      searchParams.set('vue', 'carte')
      return `/trouver-un-logement-etudiant/departement/${alert.department.slug}?${searchParams.toString()}`
    }

    return '/trouver-un-logement-etudiant'
  }

  return (
    <Button
      priority="secondary"
      linkProps={{
        href: getHref(),
        target: '_blank',
        'aria-label': tA11y('linkNewWindow', {
          label: t('countButtonLabel', { count: alert.count, pluralize: sPluriel(alert.count) }),
        }),
      }}
    >
      {t('countLabel', { count: alert.count, pluralize: sPluriel(alert.count) })}
      <span className={clsx(styles.icon, 'fr-ml-1w ri-arrow-right-line')} />
    </Button>
  )
}
