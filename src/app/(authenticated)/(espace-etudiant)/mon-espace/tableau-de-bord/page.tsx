import { notFound } from 'next/navigation'
import { StudentMaximizeChances } from '~/components/student-space/dashboard/student-maximize-chances'
import { StudentNews } from '~/components/student-space/dashboard/student-news'
import { StudentSummary } from '~/components/student-space/dashboard/student-summary'
import { StudentWelcome } from '~/components/student-space/dashboard/student-welcome'
import { getServerSession } from '~/services/better-auth'
import styles from '../mon-espace.module.css'

export default async function StudentDashboardPage() {
  const auth = await getServerSession()

  if (!auth || !auth.user) {
    return notFound()
  }

  const { user } = auth

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
