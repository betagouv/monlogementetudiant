import clsx from 'clsx'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { DossierFacileConnection } from '~/components/student-space/informations/dossier-facile-connection'
import { NotificationSettings } from '~/components/student-space/informations/notification-settings'
import { StudentProfileForm } from '~/components/student-space/informations/student-profile-form'
import { getStudentProfile } from '~/server/student/get-profile'
import styles from '../mon-espace.module.css'

export const generateMetadata = async () => {
  const t = await getTranslations('breadcrumbs.student')
  return { title: t('personalInformations.title') }
}

export default async function StudentPersonalInformationsPage() {
  const t = await getTranslations('student.personalInformations')
  const profile = await getStudentProfile()
  if (!profile) return notFound()

  return (
    <>
      <div className="fr-border-right fr-border-top fr-border-bottom fr-px-6w fr-py-5w">
        <h1>{t('title')}</h1>
        <span className="fr-text--xl fr-text-mention--grey">{t('subtitle')}</span>
      </div>
      <div className={clsx(styles.summaryContainer, 'fr-px-6w fr-py-5w fr-flex fr-direction-column fr-flex-gap-8v')}>
        <StudentProfileForm
          initialValues={{
            firstname: profile.firstname,
            lastname: profile.lastname,
            email: profile.email,
            phone: profile.phone,
            birthdate: profile.birthdate,
            scholarshipStatus: profile.scholarshipStatus,
            scholarshipType: profile.scholarshipType,
            isWorkStudy: profile.isWorkStudy,
            studyInstitution: profile.studyInstitution,
            studyYear: profile.studyYear,
          }}
        />
        <div className="fr-border-top fr-pt-5w">
          <h2 className="fr-h4">{t('notifications.title')}</h2>
          <NotificationSettings
            initialSimilarAlert={profile.similarAccommodationAlertsEnabled}
            initialFavoriteAlert={profile.favoriteAlertsEnabled}
          />
        </div>
        <DossierFacileConnection />
      </div>
    </>
  )
}
