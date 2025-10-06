import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import styles from './logement.module.css'

export const PrepareStudentLifeRedirection = ({ city }: { city: string }) => {
  const t = useTranslations('prepareStudentLife')
  return (
    <div className={clsx(styles.section, styles.prepareStudentLifeSection)}>
      <h4 style={{ margin: 0 }}>{t('title', { title: city })}</h4>
      <Button priority="tertiary" size="small" linkProps={{ href: `/preparer-sa-vie-etudiante/${city}` }}>
        {t('discoverCta', { title: city })}
      </Button>
    </div>
  )
}
