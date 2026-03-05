import { redirect } from 'next/navigation'
import { getServerSession } from '~/services/better-auth'

export default async function AdministrationPage() {
  const session = await getServerSession()
  if (session?.user.role === 'admin') {
    redirect('/administration/tableau-de-bord')
  }
  return null
}
