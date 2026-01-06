import clsx from 'clsx'
import { CreateStudentAlert } from '~/components/student-space/alerts/create-student-alert'
import { StudentAlerts } from '~/components/student-space/alerts/student-alerts'
import styles from '../mon-espace.module.css'

export default async function StudentAlertsPage() {
  return (
    <>
      <div className="fr-border-right fr-border-top fr-border-bottom fr-px-6w fr-py-5w">
        <h1>Mes alertes logements</h1>
        <span className="fr-text--xl fr-text-mention--grey">Les nouvelles offres de logements disponibles en temps réel</span>
      </div>
      <div
        className={clsx(
          styles.summaryContainer,
          'fr-flex fr-direction-column fr-justify-content-center fr-align-items-center fr-py-3w fr-px-3w fr-flex-gap-8v',
        )}
      >
        <StudentAlerts />
        <CreateStudentAlert />
      </div>
    </>
  )
}
