import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { formatCityWithA } from '~/utils/french-contraction'
import styles from './logement.module.css'

export const PrepareStudentLifeRedirection = ({ city }: { city: string }) => {
  const t = useTranslations('prepareStudentLife')
  const titleFormatted = formatCityWithA(city)
  return (
    <div className={clsx(styles.section, styles.prepareStudentLifeSection)}>
      <h4 style={{ margin: 0 }}>{t('title', { titleFormatted })}</h4>
      <Button priority="tertiary" size="small" linkProps={{ href: `/preparer-sa-vie-etudiante/${city}` }}>
        {t('discoverCta', { title: city })}
      </Button>
    </div>
  )
}
