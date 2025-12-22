import { notFound } from 'next/navigation'
import { auth } from '~/auth'
import { StudentMaximizeChances } from '~/components/student-space/dashboard/student-maximize-chances'
import { StudentNews } from '~/components/student-space/dashboard/student-news'
import { StudentSummary } from '~/components/student-space/dashboard/student-summary'
import { StudentWelcome } from '~/components/student-space/dashboard/student-welcome'
import styles from '../mon-espace.module.css'

export default async function StudentDashboardPage() {
  const session = await auth()

  if (!session) {
    return notFound()
  }

  const { user } = session

  return (
    <>
      <StudentWelcome user={user} />
      <div className={styles.summaryContainer}>
        <StudentSummary />
        <StudentMaximizeChances />
        <StudentNews />
      </div>
    </>
  )
}
