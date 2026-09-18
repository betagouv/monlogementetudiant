import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { useLocale, useTranslations } from 'next-intl'
import { formatCityWithPreposition } from '~/utils/french-contraction'
import styles from './logement.module.css'

export const PrepareStudentLifeRedirection = ({ city }: { city: string }) => {
  const t = useTranslations('prepareStudentLife')
  const locale = useLocale()
  const titleFormatted = formatCityWithPreposition(locale, 'à', city)
  return (
    <div className={clsx(styles.section, styles.prepareStudentLifeSection)}>
      <h3 className="fr-h4 fr-m-0">{t('title', { titleFormatted })}</h3>
      <Button priority="tertiary" size="small" linkProps={{ href: `/preparer-sa-vie-etudiante/${city}` }}>
        {t('discoverCta', { title: city })}
      </Button>
    </div>
  )
}
