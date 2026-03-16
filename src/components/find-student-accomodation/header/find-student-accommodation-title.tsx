'use client'

import { fr } from '@codegouvfr/react-dsfr'
import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb'
import { useTranslations } from 'next-intl'
import { parseAsBoolean, useQueryState } from 'nuqs'
import { FC } from 'react'
import { tss } from 'tss-react'
import { applyFrenchContraction } from '~/utils/french-contraction'

interface FindStudentAccommodationTitleProps {
  location: string | undefined
}

export const FindStudentAccommodationTitle: FC<FindStudentAccommodationTitleProps> = ({ location }) => {
  const { classes } = useStyles()
  const t = useTranslations('findAccomodation')

  const [mapSearch] = useQueryState('recherche-par-carte', parseAsBoolean.withDefault(false))
  const title = location && !mapSearch ? t('titleWithLocation', { locationFormatted: applyFrenchContraction('à', location) }) : t('title')

  return (
    <>
      <Breadcrumb currentPageLabel={title} homeLinkProps={{ href: '/' }} segments={[]} classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }} />
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
