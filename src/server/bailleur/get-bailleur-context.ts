import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { getServerSession } from '~/services/better-auth'
import { getOwnerForUser } from './get-owner-for-user'
import { type BailleurPermission, type BailleurRole, hasPermission, hasRole, type PermissionCheckUser } from './permissions'

export const getBailleurContext = cache(async (ownerIdParam?: string) => {
  const session = await getServerSession()
  if (!session) notFound()
  if (session.user.role === 'user') redirect('/mon-espace/tableau-de-bord')

  const owner = await getOwnerForUser(session.user.id, ownerIdParam ? Number(ownerIdParam) : undefined)
  if (!owner) notFound()

  const checkUser: PermissionCheckUser = {
    role: session.user.role,
    bailleurRole: (session.user.bailleurRole as BailleurRole | null) ?? null,
    bailleurPermissions: (session.user.bailleurPermissions as BailleurPermission[]) ?? [],
  }

  return {
    session,
    owner,
    user: checkUser,
    hasRole: (r: BailleurRole) => hasRole(checkUser, r),
    hasPermission: (p: BailleurPermission) => hasPermission(checkUser, p),
  }
})
