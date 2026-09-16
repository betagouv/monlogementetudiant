import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { StudentFavorites } from '~/components/student-space/favorites/student-favorites'
import { NotificationToggle } from '~/components/student-space/notification-toggle'
import { getNotificationPreferences } from '~/server/student/get-notification-preferences'
import { getServerSession } from '~/services/better-auth'
import styles from '../mon-espace.module.css'

export const generateMetadata = async () => {
  const t = await getTranslations('breadcrumbs.student')
  return { title: t('favorites.title') }
}

export default async function StudentFavoritesPage() {
  const auth = await getServerSession()
  if (!auth || !auth.user) return notFound()

  const [t, notifPrefs] = await Promise.all([getTranslations('student.favorites'), getNotificationPreferences()])

  return (
    <>
      <div className="fr-border-right fr-border-top fr-border-bottom fr-px-6w fr-py-5w">
        <h1>{t('pageTitle')}</h1>
        <span className="fr-text--xl fr-text-mention--grey">{t('pageDescription')}</span>
      </div>
      <div
        className={clsx(styles.summaryContainer, 'fr-flex fr-direction-column fr-justify-content-center fr-align-items-center fr-py-3w')}
      >
        <div className="fr-width-full fr-px-2w">
          <NotificationToggle
            email={auth.user.email}
            initialChecked={notifPrefs.favoriteAlertsEnabled}
            preference="favoriteAlertsEnabled"
            translationNamespace="student.favorites"
            inputTitle="notif-favorite-alert"
          />
        </div>
        <StudentFavorites />
        <div>
          <Button priority="secondary" linkProps={{ href: '/trouver-un-logement-etudiant' }}>
            {t('explore')}
          </Button>
        </div>
      </div>
    </>
  )
}
