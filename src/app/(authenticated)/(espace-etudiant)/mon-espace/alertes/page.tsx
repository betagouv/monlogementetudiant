import clsx from 'clsx'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { CreateStudentAlert } from '~/components/student-space/alerts/create-student-alert'
import { StudentAlerts } from '~/components/student-space/alerts/student-alerts'
import { NotificationToggle } from '~/components/student-space/notification-toggle'
import { getNotificationPreferences } from '~/server/student/get-notification-preferences'
import { getServerSession } from '~/services/better-auth'
import styles from '../mon-espace.module.css'

export const generateMetadata = async () => {
  const t = await getTranslations('breadcrumbs.student')
  return { title: t('alerts.title') }
}

export default async function StudentAlertsPage() {
  const auth = await getServerSession()
  if (!auth || !auth.user) return notFound()

  const [t, notifPrefs] = await Promise.all([getTranslations('student.alerts'), getNotificationPreferences()])

  return (
    <>
      <div className="fr-border-right fr-border-top fr-border-bottom fr-px-6w fr-py-5w">
        <h1>{t('pageTitle')}</h1>
        <span className="fr-text--xl fr-text-mention--grey">{t('pageDescription')}</span>
      </div>
      <div
        className={clsx(
          styles.summaryContainer,
          'fr-flex fr-direction-column fr-justify-content-center fr-align-items-center fr-py-3w fr-px-3w fr-flex-gap-8v',
        )}
      >
        <div className="fr-width-full fr-px-2w">
          <NotificationToggle
            email={auth.user.email}
            initialChecked={notifPrefs.similarAccommodationAlertsEnabled}
            preference="similarAccommodationAlertsEnabled"
            translationNamespace="student.alerts"
            inputTitle="notif-similar-alert"
          />
        </div>
        <StudentAlerts />
        <CreateStudentAlert />
      </div>
    </>
  )
}
