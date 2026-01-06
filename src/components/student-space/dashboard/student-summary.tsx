import Tile from '@codegouvfr/react-dsfr/Tile'
import { getTranslations } from 'next-intl/server'
import { getAlerts } from '~/server-only/student/get-alerts'
import { getFavorites } from '~/server-only/student/get-favorites'
import styles from './student-summary.module.css'

export const StudentSummary = async () => {
  const t = await getTranslations('student.summary')
  const [favorites, alerts] = await Promise.all([getFavorites(), getAlerts()])
  return (
    <div className="fr-flex fr-direction-column fr-flex-gap-4v fr-pt-4w fr-px-6w fr-pb-6w">
      <span className="fr-h4">{t('title')}</span>
      <div className="fr-flex fr-direction-column fr-direction-md-row fr-flex-gap-4v fr-justify-content-space-between">
        <div className="fr-width-full">
          <Tile
            pictogram={<span className={styles.tileIcon}>♥️</span>}
            enlargeLinkOrButton
            linkProps={{
              href: 'favoris',
            }}
            orientation="vertical"
            title={t('favorites', { count: favorites.count })}
            titleAs="h3"
          />
        </div>
        <div className="fr-width-full">
          <Tile
            pictogram={<span className={styles.tileIcon}>📬</span>}
            enlargeLinkOrButton
            linkProps={{
              href: 'alertes',
            }}
            orientation="vertical"
            title={t('alerts', { count: alerts.count })}
            titleAs="h3"
          />
        </div>
      </div>
    </div>
  )
}
