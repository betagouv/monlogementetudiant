'use client'

import { fr } from '@codegouvfr/react-dsfr'
import { useTranslations } from 'next-intl'
import { parseAsBoolean, useQueryState } from 'nuqs'
import { FC } from 'react'
import { tss } from 'tss-react'
import { DynamicBreadcrumb } from '~/components/ui/breadcrumb'
import { formatCityWithA } from '~/utils/french-contraction'

interface FindStudentAccommodationTitleProps {
  location: string | undefined
}

export const FindStudentAccommodationTitle: FC<FindStudentAccommodationTitleProps> = ({ location }) => {
  const { classes } = useStyles()
  const t = useTranslations('findAccomodation')

  const [mapSearch] = useQueryState('recherche-par-carte', parseAsBoolean.withDefault(false))
  const title = location && !mapSearch ? t('titleWithLocation', { locationFormatted: formatCityWithA(location) }) : t('title')

  return (
    <>
      <DynamicBreadcrumb title={title} />
      <h1 className={classes.title}>{title}</h1>
    </>
  )
}

const useStyles = tss.create({
  title: {
    [fr.breakpoints.down('md')]: {
      fontSize: '1.375rem',
      lineHeight: '1.75rem',
    },
  },
})
